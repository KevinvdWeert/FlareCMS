import firebase_admin
from firebase_admin import auth, credentials, firestore
from google.api_core.exceptions import PermissionDenied
from firebase_admin.auth import UserNotFoundError
from pathlib import Path
import os
import sys

# Requirements:
# pip install firebase-admin
# You need a service account JSON key from Firebase Console -> Project Settings -> Service Accounts
# Generate new private key and save it as `serviceAccountKey.json` in this directory.

def bootstrap_admin(identifier, email=None):
    script_dir = Path(__file__).resolve().parent
    key_path = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')
    key_file = Path(key_path).expanduser() if key_path else script_dir / 'serviceAccountKey.json'

    try:
        cred = credentials.Certificate(str(key_file))
        firebase_admin.initialize_app(cred)
    except FileNotFoundError:
        print(f"Error: Could not find service account key at: {key_file}")
        print("Download it from Firebase Console -> Project Settings -> Service Accounts.")
        print("Save it as scripts/serviceAccountKey.json or set FIREBASE_SERVICE_ACCOUNT_KEY to its full path.")
        sys.exit(1)
    except Exception as exc:
        print(f"Error: Failed to initialize Firebase Admin SDK: {exc}")
        sys.exit(1)

    # Accept either a UID or an email as the first argument.
    try:
        if '@' in identifier:
            user_record = auth.get_user_by_email(identifier)
            uid = user_record.uid
            if email is None:
                email = user_record.email
        else:
            uid = identifier
    except UserNotFoundError:
        print(f"Error: No Firebase Auth user found for '{identifier}'.")
        print("Create the user in Firebase Authentication first, then rerun this script.")
        sys.exit(1)

    try:
        db = firestore.client()

        user_ref = db.collection('users').document(uid)

        # Check if doc exists to preserve data, or create a new one
        doc = user_ref.get()

        data = {
            'role': 'admin'
        }

        if not doc.exists and email:
            data['email'] = email
            data['displayName'] = 'Admin User'
            data['createdAt'] = firestore.SERVER_TIMESTAMP

        user_ref.set(data, merge=True)
    except PermissionDenied as exc:
        print("Error: Firestore access denied.")
        print("Enable Cloud Firestore API and create a Firestore database in your Firebase project, then retry.")
        print("API enable link: https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=custom-cms-1c4c7")
        print(f"Details: {exc}")
        sys.exit(1)
    except Exception as exc:
        print(f"Error: Failed while writing admin role in Firestore: {exc}")
        sys.exit(1)

    print(f"Successfully bootstrapped user {uid} as an admin in Firestore.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python bootstrap_admin.py <uid_or_email> [email]")
        sys.exit(1)
        
    uid = sys.argv[1]
    email = sys.argv[2] if len(sys.argv) > 2 else None
    bootstrap_admin(uid, email)
