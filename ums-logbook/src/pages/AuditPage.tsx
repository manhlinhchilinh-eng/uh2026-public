/**
 * UMS Digital Class Logbook - Audit Logs Page
 * Milestone 6: Admin Audit Trail Management Page
 * Path: src/pages/AuditPage.tsx
 */

import React from 'react';
import { AuditLogViewer } from '../components/admin/AuditLogViewer';

export const AuditPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
      <AuditLogViewer />
    </div>
  );
};

export default AuditPage;
