import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { gdprApi } from '../services/api';
import { useUI } from '../providers/UIProvider';
import type { GdprRecord } from '../services/api/gdpr.api';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export function GdprToolsPage() {
  const { addToast } = useUI();
  const [email, setEmail] = useState('');
  const [exportedData, setExportedData] = useState<GdprRecord[] | null>(null);
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);

  const exportMutation = useMutation({
    mutationFn: (targetEmail: string) => gdprApi.exportData(targetEmail),
    onSuccess: (response) => {
      const records = response.data ?? [];
      setExportedData(records);
      if (records.length === 0) {
        addToast('info', 'No data found for this email address');
      } else {
        addToast('success', `Found ${records.length} record(s) for this email`);
      }
    },
    onError: () => addToast('error', 'Failed to export data. Please try again.'),
  });

  const eraseMutation = useMutation({
    mutationFn: (targetEmail: string) => gdprApi.eraseData(targetEmail),
    onSuccess: (result) => {
      setShowEraseConfirm(false);
      setExportedData(null);
      setEmail('');
      addToast(
        'success',
        `Erased ${result.erasedRecords} record(s) at ${new Date(result.erasedAt).toLocaleString()}.`,
      );
    },
    onError: () => {
      setShowEraseConfirm(false);
      addToast('error', 'Failed to erase data. Please try again.');
    },
  });

  const isValidEmail = email.includes('@') && email.includes('.');

  function handleExport(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail) return;
    setExportedData(null);
    exportMutation.mutate(email);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 sm:text-display-xs">
          GDPR Tools
        </h1>
        <p className="mt-1 text-sm text-surface-500">
          Export or erase personal data associated with an email address.
        </p>
      </div>

      {/* Info banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4"
      >
        <ShieldCheckIcon className="h-5 w-5 shrink-0 text-brand-600 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-brand-800">GDPR Compliance</p>
          <p className="mt-0.5 text-sm text-brand-700">
            This tool allows you to fulfill data subject access requests (DSAR) and right-to-erasure requests.
          </p>
        </div>
      </motion.div>

      {/* Search form */}
      <Card padding="md">
        <form onSubmit={handleExport} className="space-y-4">
          <div>
            <label
              htmlFor="gdpr-email"
              className="block text-sm font-medium text-surface-700 mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <input
                id="gdpr-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="block w-full rounded-xl border border-surface-200 bg-white py-3 pl-10 pr-4 text-sm placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              disabled={!isValidEmail}
              loading={exportMutation.isPending}
              icon={<ArrowDownTrayIcon className="h-4 w-4" />}
            >
              Export Data
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => setShowEraseConfirm(true)}
              disabled={!isValidEmail || eraseMutation.isPending}
              icon={<TrashIcon className="h-4 w-4" />}
            >
              Erase Data
            </Button>
          </div>
        </form>
      </Card>

      {/* Erase Confirmation Modal */}
      <Modal
        open={showEraseConfirm}
        onClose={() => setShowEraseConfirm(false)}
        title="Confirm Data Erasure"
        description="This action cannot be undone."
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4">
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <p className="text-sm text-red-700">
              Are you sure you want to permanently erase all data for{' '}
              <span className="font-semibold">{email}</span>?
              This includes all enquiries and associated records.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => setShowEraseConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => eraseMutation.mutate(email)}
              loading={eraseMutation.isPending}
              icon={<TrashIcon className="h-4 w-4" />}
            >
              Yes, Erase Data
            </Button>
          </div>
        </div>
      </Modal>

      {/* Exported Data Results */}
      <AnimatePresence>
        {exportedData !== null && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Card padding="none">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-surface-400" />
                    <h2 className="text-base font-semibold text-surface-900">
                      Export Results
                    </h2>
                    <Badge variant="info" size="sm">
                      {exportedData.length} record{exportedData.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              {exportedData.length === 0 ? (
                <CardBody>
                  <div className="py-8 text-center">
                    <CheckCircleIcon className="mx-auto h-10 w-10 text-surface-300" />
                    <p className="mt-2 text-sm text-surface-500">
                      No records found for this email address.
                    </p>
                  </div>
                </CardBody>
              ) : (
                <div className="divide-y divide-surface-100">
                  {exportedData.map((record, index) => (
                    <div key={index} className="px-5 py-4 sm:px-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge
                          variant={record.type === 'enquiry' ? 'info' : 'purple'}
                          size="sm"
                        >
                          {record.type}
                        </Badge>
                      </div>
                      <div className="rounded-xl bg-surface-50 p-4 overflow-auto max-h-48">
                        <pre className="text-xs font-mono text-surface-700 whitespace-pre-wrap">
                          {JSON.stringify(record.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
