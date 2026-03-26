import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  AlignJustify,
  LayoutTemplate,
  Home,
  Fingerprint,
  Search,
  Puzzle,
  Phone,
  ImageOff,
  Link2,
} from 'lucide-react';

const NAV_LINKS = [
  { to: '/admin/settings/footer', label: 'Footer', icon: <AlignJustify size={15} /> },
  { to: '/admin/settings/header', label: 'Header & Nav', icon: <LayoutTemplate size={15} /> },
  { to: '/admin/settings/homepage', label: 'Homepage', icon: <Home size={15} /> },
  { to: '/admin/settings/identity', label: 'Site Identity', icon: <Fingerprint size={15} /> },
  { to: '/admin/settings/seo', label: 'SEO Defaults', icon: <Search size={15} /> },
  { to: '/admin/settings/snippets', label: 'Snippets', icon: <Puzzle size={15} /> },
  { to: '/admin/settings/contact', label: 'Contact Info', icon: <Phone size={15} /> },
  { to: '/admin/settings/media-credits', label: 'Media Credits', icon: <ImageOff size={15} /> },
  { to: '/admin/settings/link-checker', label: 'Link Checker', icon: <Link2 size={15} /> },
];

export const SettingsLayout = () => {
  return (
    <div className="admin-section settings-layout">
      <nav className="settings-subnav">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `settings-subnav-link${isActive ? ' is-active' : ''}`}
          >
            {link.icon}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="settings-main">
        <Outlet />
      </main>
    </div>
  );
};
