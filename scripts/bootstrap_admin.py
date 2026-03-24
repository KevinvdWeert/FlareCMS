import firebase_admin
from firebase_admin import credentials, firestore
import sys

# Requirements:
# pip install firebase-admin
# You need a service account JSON key from Firebase Console -> Project Settings -> Service Accounts
# Generate new private key and save it as `serviceAccountKey.json` in this directory.

def bootstrap_admin(uid, email=None):
    try:
        cred = credentials.Certificate('serviceAccountKey.json')
        firebase_admin.initialize_app(cred)
    except FileNotFoundError:
        print("Error: Could not find serviceAccountKey.json in the current directory.")
        print("Please download it from Firebase Console and place it in the same directory as this script.")
        sys.exit(1)

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
    
    print(f"Successfully bootstrapped user {uid} as an admin in Firestore.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python bootstrap_admin.py <uid> [email]")
        sys.exit(1)
        
    uid = sys.argv[1]
    email = sys.argv[2] if len(sys.argv) > 2 else None
    bootstrap_admin(uid, email)
