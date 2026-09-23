import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock } from 'lucide-react';

import ModalForm from '../../components/ModalForm';
import { attendanceApi } from '../../api/attendanceApi';

const formatTimeForInput = (value) => {
  if (!value || value === '-') return '';

  // Handles:
  // 09:30
  // 09:30:00
  // 2026-09-22 09:30:00
  const match = String(value).match(/(\d{2}):(\d{2})/);

  if (!match) return '';

  return `${match[1]}:${match[2]}`;
};

export default function AttendanceEdit({
  isOpen,
  onClose,
  attendance,
  onUpdated
}) {
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    inTime: '',
    outTime: ''
  });

  useEffect(() => {
    if (!attendance) return;

    setFormData({
      inTime: formatTimeForInput(attendance.inTime),
      outTime: formatTimeForInput(attendance.outTime)
    });
  }, [attendance]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!attendance?.id) {
      toast.error('Attendance record not found');
      return;
    }

    if (loading) return;

    if (!formData.inTime && !formData.outTime) {
      toast.error('Please enter at least one time');
      return;
    }

    setLoading(true);

    console.log('handle submit triggred!!')

    try {
      await attendanceApi.updateAttendanceLog(
        attendance.id,
        {
          inTime: formData.inTime || null,
          outTime: formData.outTime || null
        }
      );

      console.log('update operation done ..')

      toast.success('Attendance updated successfully');

      onUpdated?.();
      onClose();

    } catch (error) {
      console.error('Failed to update attendance:', error);
      toast.error('Failed to update attendance');

    } finally {
      setLoading(false);
    }
  };

  if (!attendance) return null;

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Attendance"
      onSubmit={handleSubmit}
      submitText="Save Changes"
      loading={loading}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">

        {/* Employee */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Employee
          </label>

          <input
            type="text"
            value={attendance.userName || '-'}
            disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>

          <input
            type="text"
            value={attendance.date || '-'}
            disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
          />
        </div>

        {/* IN */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <Clock size={16} />
            IN Time
          </label>

          <input
            type="time"
            name="inTime"
            value={formData.inTime}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* OUT */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <Clock size={16} />
            OUT Time
          </label>

          <input
            type="time"
            name="outTime"
            value={formData.outTime}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

      </div>
    </ModalForm>
  );
}