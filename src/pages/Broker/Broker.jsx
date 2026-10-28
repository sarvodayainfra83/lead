import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Search,
  Plus,
  RotateCcw,
  User,
  Phone,
  Mail,
  Building2,
  MapPin,
  ShieldCheck,
  Percent,
  Eye,
  Pencil,
  Trash2,
  Users,
  Award,
  Sparkles,
  ExternalLink,
  MessageCircle,
  Copy,
  Check,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { brokerApi } from '../../api/brokerApi';
import { masterApi } from '../../api/masterApi';
import BrokerFormModal from './BrokerFormModal';
import BrokerDetailsModal from './BrokerDetailsModal';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess, isUserAdmin } from '../../utils/authUtils';

export default function Broker() {
  const user = useAuthStore(state => state.user);
  const canEdit = isUserAdmin(user) || hasFullAccess(user, 'broker');

  const [brokers, setBrokers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectType, setSelectedProjectType] = useState('');
  const [selectedDealPreferred, setSelectedDealPreferred] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // View mode
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [brokerToEdit, setBrokerToEdit] = useState(null);
  const [brokerToView, setBrokerToView] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Masters
  const [projectTypeOptions, setProjectTypeOptions] = useState([]);
  const [dealPreferredOptions, setDealPreferredOptions] = useState([]);

  // Load Brokers and Masters
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [brokerList, reqs, prods] = await Promise.all([
        brokerApi.getBrokers(),
        masterApi.getRealEstateRequirements().catch(() => []),
        masterApi.getRealEstateProducts().catch(() => [])
      ]);
      setBrokers(brokerList || []);

      if (reqs) {
        setDealPreferredOptions(
          reqs.map(r => r.requirement).filter(Boolean)
        );
      }
      if (prods) {
        setProjectTypeOptions(
          prods.map(p => p.productType).filter(Boolean)
        );
      }
    } catch (err) {
      console.error('Failed to load broker records:', err);
      toast.error('Failed to load broker records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Brokers
  const filteredBrokers = useMemo(() => {
    return brokers.filter(b => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (b.name || '').toLowerCase().includes(q);
        const matchesPhone = (b.phone || '').includes(q) || (b.alternatePhone || '').includes(q);
        const matchesEmail = (b.email || '').toLowerCase().includes(q);
        const matchesBusiness = (b.businessName || '').toLowerCase().includes(q);
        const matchesPan = (b.pan || '').toLowerCase().includes(q);
        const matchesRera = (b.reraNo || '').toLowerCase().includes(q);
        const matchesAadhar = (b.aadharNo || '').includes(q);
        const matchesProject = (b.projectType || '').toLowerCase().includes(q);
        const matchesDeal = (b.dealPreferred || '').toLowerCase().includes(q);

        if (!matchesName && !matchesPhone && !matchesEmail && !matchesBusiness && !matchesPan && !matchesRera && !matchesAadhar && !matchesProject && !matchesDeal) {
          return false;
        }
      }

      // Project Type
      if (selectedProjectType && b.projectType !== selectedProjectType) {
        return false;
      }

      // Deal Preferred
      if (selectedDealPreferred && b.dealPreferred !== selectedDealPreferred) {
        return false;
      }

      // Status
      if (selectedStatus !== 'ALL' && b.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [brokers, searchQuery, selectedProjectType, selectedDealPreferred, selectedStatus]);

  // Pagination calculation
  const totalItems = filteredBrokers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedBrokers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBrokers.slice(start, start + itemsPerPage);
  }, [filteredBrokers, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedProjectType, selectedDealPreferred, selectedStatus]);

  // KPI Calculations
  const kpiStats = useMemo(() => {
    const total = brokers.length;
    const active = brokers.filter(b => b.status === 'ACTIVE').length;
    const totalComm = brokers.reduce((acc, b) => acc + (b.commissionPercentage || 0), 0);
    const avgComm = total > 0 ? (totalComm / total).toFixed(2) : '0.00';

    // Top Project Type
    const projCount = {};
    brokers.forEach(b => {
      if (b.projectType) projCount[b.projectType] = (projCount[b.projectType] || 0) + 1;
    });
    const topProj = Object.entries(projCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return { total, active, avgComm, topProj };
  }, [brokers]);

  // Delete handler
  const handleDelete = async (id) => {
    try {
      await brokerApi.deleteBroker(id);
      toast.success('Broker removed successfully');
      setDeleteConfirmId(null);
      loadData();
    } catch (err) {
      toast.error('Failed to delete broker: ' + (err.message || ''));
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedProjectType('');
    setSelectedDealPreferred('');
    setSelectedStatus('ALL');
  };

  return (
    <div className="flex flex-col md:h-full min-h-0 bg-slate-50/50 p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-5 md:overflow-y-auto">

      {/* Page Header */}
      <div className="bg-white rounded-2xl p-3 sm:p-5 border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <Users size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                  Brokers Directory
                </h1>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full border border-indigo-100">
                  {brokers.length} Registered
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Manage broker profiles, deal preferences, commissions & RERA compliance
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Refresh */}
          <button
            type="button"
            onClick={loadData}
            className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl border border-gray-200 transition cursor-pointer"
            title="Refresh list"
          >
            <RotateCcw size={16} />
          </button>

          {/* Add Broker Button */}
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setBrokerToEdit(null);
                setShowAddModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-indigo-500/25 transition cursor-pointer"
            >
              <Plus size={16} />
              Add New Broker
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        {/* Total Brokers */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Total Brokers
            </span>
            <span className="text-xl sm:text-2xl font-black text-gray-900 mt-1 block">
              {kpiStats.total}
            </span>
            <span className="text-[10px] text-gray-500 font-medium">On-boarded network</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users size={20} />
          </div>
        </div>

        {/* Active Brokers */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Active Network
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 mt-1 block">
              {kpiStats.active}
            </span>
            <span className="text-[10px] text-gray-500 font-medium">Ready for allotment</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
        </div>

        {/* Average Commission */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Avg Commission
            </span>
            <span className="text-xl sm:text-2xl font-black text-indigo-600 mt-1 block">
              {kpiStats.avgComm}%
            </span>
            <span className="text-[10px] text-gray-500 font-medium">Per closed deal</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Percent size={20} />
          </div>
        </div>

        {/* Top Specialization */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Top Project Type
            </span>
            <span className="text-xs sm:text-sm font-bold text-amber-700 mt-1 block truncate max-w-[130px]" title={kpiStats.topProj}>
              {kpiStats.topProj}
            </span>
            <span className="text-[10px] text-gray-500 font-medium">Highest broker focus</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Building2 size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-gray-100 shadow-sm space-y-2 sm:space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
          
          {/* Search Input */}
          <div className="col-span-2 lg:col-span-2 relative">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, RERA, PAN, business..."
              className="w-full h-10 pl-9 pr-4 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Project Type Filter */}
          <div>
            <select
              value={selectedProjectType}
              onChange={(e) => setSelectedProjectType(e.target.value)}
              className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
            >
              <option value="">All Project Types</option>
              {projectTypeOptions.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Deal Preferred Filter */}
          <div>
            <select
              value={selectedDealPreferred}
              onChange={(e) => setSelectedDealPreferred(e.target.value)}
              className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
            >
              <option value="">All Deal Preferred</option>
              {dealPreferredOptions.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Status & View Switcher */}
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>

            {/* Clear filters */}
            {(searchQuery || selectedProjectType || selectedDealPreferred || selectedStatus !== 'ALL') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition cursor-pointer flex-shrink-0"
                title="Reset all filters"
              >
                <RotateCcw size={15} />
              </button>
            )}

            {/* Toggle Table / Card view */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 flex-shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
                title="Table View"
              >
                <List size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
                title="Cards View"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Loading Brokers Data...</p>
        </div>
      ) : filteredBrokers.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300 mb-3">
            <Users size={28} />
          </div>
          <h3 className="text-sm font-bold text-gray-800">No Brokers Found</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm">
            {searchQuery || selectedProjectType || selectedDealPreferred || selectedStatus !== 'ALL'
              ? 'No brokers match your current search or filters. Try resetting the filters.'
              : 'No broker records available. Click "+ Add New Broker" to add the first one.'}
          </p>
          {(searchQuery || selectedProjectType || selectedDealPreferred || selectedStatus !== 'ALL') ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition"
            >
              Reset Filters
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setBrokerToEdit(null);
                setShowAddModal(true);
              }}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
            >
              + Add First Broker
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm md:overflow-hidden flex flex-col">

          {/* Mobile compact list — replaces the wide table on small screens */}
          <div className="md:hidden divide-y divide-gray-100">
            {paginatedBrokers.map((broker) => (
              <div key={broker.id} className="p-3 flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer"
                  onClick={() => broker.photoUrl && setImagePreview({ url: broker.photoUrl, title: `${broker.name} - Photo` })}
                >
                  {broker.photoUrl ? (
                    <img src={broker.photoUrl} alt={broker.name} className="w-full h-full object-cover" />
                  ) : (
                    <User size={18} className="text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-sm text-gray-900 truncate">{broker.name}</span>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded flex-shrink-0 ${
                        broker.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {broker.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button type="button" onClick={() => setBrokerToView(broker)} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer" title="View">
                        <Eye size={14} />
                      </button>
                      {canEdit && (
                        <>
                          <button type="button" onClick={() => { setBrokerToEdit(broker); setShowAddModal(true); }} className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button type="button" onClick={() => setDeleteConfirmId(broker.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 font-medium truncate">{broker.businessName || 'Independent'}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                    <a href={`tel:${broker.phone}`} className="font-bold text-gray-700 hover:text-indigo-600">+91 {broker.phone}</a>
                    <span className="text-gray-300">|</span>
                    <span className="font-bold text-indigo-700">{broker.commissionPercentage != null ? broker.commissionPercentage : 0}%</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {broker.projectType && (
                      <span className="text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded truncate max-w-[120px]">{broker.projectType}</span>
                    )}
                    {broker.dealPreferred && (
                      <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded truncate max-w-[120px]">{broker.dealPreferred}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop full table */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 text-[11px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3.5 px-4">Broker Name & Business</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4">Project & Deal Preferred</th>
                  <th className="py-3.5 px-4 text-center">Commission</th>
                  <th className="py-3.5 px-4">Govt IDs (PAN / Aadhar / RERA)</th>
                  <th className="py-3.5 px-4">Business Address</th>
                  <th className="py-3.5 px-4 text-center">Photos</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                {paginatedBrokers.map((broker) => (
                  <tr key={broker.id} className="hover:bg-slate-50/70 transition">
                    
                    {/* Broker & Business */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-indigo-400 transition"
                          onClick={() => broker.photoUrl && setImagePreview({ url: broker.photoUrl, title: `${broker.name} - Photo` })}
                        >
                          {broker.photoUrl ? (
                            <img src={broker.photoUrl} alt={broker.name} className="w-full h-full object-cover" />
                          ) : (
                            <User size={18} className="text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900">{broker.name}</span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                              broker.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {broker.status}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-500 font-medium block truncate max-w-[180px]">
                            {broker.businessName || 'Independent'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Contact Info */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${broker.phone}`}
                            className="font-bold text-gray-900 hover:text-indigo-600"
                          >
                            +91 {broker.phone}
                          </a>
                          <a
                            href={`https://wa.me/91${broker.phone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 hover:bg-emerald-50 p-0.5 rounded"
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle size={13} />
                          </a>
                        </div>
                        {broker.alternatePhone && (
                          <div className="text-[10px] text-gray-400">
                            Alt: +91 {broker.alternatePhone}
                          </div>
                        )}
                        <a
                          href={`mailto:${broker.email}`}
                          className="text-[11px] text-indigo-600 hover:underline block truncate max-w-[160px]"
                          title={broker.email}
                        >
                          {broker.email}
                        </a>
                      </div>
                    </td>

                    {/* Project & Deal Preferred */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-tight">Project Type</span>
                          <span className="inline-block px-2 py-0.5 text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
                            {broker.projectType || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-tight">Deal Preferred</span>
                          <span className="inline-block px-2 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
                            {broker.dealPreferred || '-'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Commission */}
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex flex-col items-center justify-center bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1">
                        <span className="text-sm font-black text-indigo-700">
                          {broker.commissionPercentage != null ? broker.commissionPercentage : '0'}%
                        </span>
                        <span className="text-[9px] text-indigo-500 font-semibold uppercase">rate</span>
                      </div>
                    </td>

                    {/* Compliance & IDs */}
                    <td className="py-3 px-4">
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center gap-1 font-mono">
                          <span className="text-gray-400 text-[10px] w-12 uppercase">PAN:</span>
                          <span className="font-bold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded text-[10.5px]">
                            {broker.pan || '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 font-mono">
                          <span className="text-gray-400 text-[10px] w-12 uppercase">Aadhar:</span>
                          <span className="text-gray-700 text-[10.5px]">
                            {broker.aadharNo || '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400 text-[10px] w-12 uppercase">RERA:</span>
                          <span className="font-bold text-indigo-700 font-mono text-[10.5px] truncate max-w-[140px]" title={broker.reraNo}>
                            {broker.reraNo || '-'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Business Address */}
                    <td className="py-3 px-4">
                      <div className="max-w-[200px] text-gray-600 text-[11px] leading-relaxed line-clamp-2" title={broker.businessAddress}>
                        {broker.businessAddress || '-'}
                      </div>
                    </td>

                    {/* Photos */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Broker photo */}
                        <div
                          className={`w-7 h-7 rounded-lg border overflow-hidden flex items-center justify-center ${
                            broker.photoUrl ? 'border-indigo-300 cursor-pointer hover:scale-110 transition' : 'border-gray-200 bg-gray-50'
                          }`}
                          title="Personal Photo"
                          onClick={() => broker.photoUrl && setImagePreview({ url: broker.photoUrl, title: `${broker.name} - Photo` })}
                        >
                          {broker.photoUrl ? (
                            <img src={broker.photoUrl} alt="Photo" className="w-full h-full object-cover" />
                          ) : (
                            <User size={12} className="text-gray-300" />
                          )}
                        </div>

                        {/* Business photo */}
                        <div
                          className={`w-7 h-7 rounded-lg border overflow-hidden flex items-center justify-center ${
                            broker.businessPhotoUrl ? 'border-indigo-300 cursor-pointer hover:scale-110 transition' : 'border-gray-200 bg-gray-50'
                          }`}
                          title="Business Photo"
                          onClick={() => broker.businessPhotoUrl && setImagePreview({ url: broker.businessPhotoUrl, title: `${broker.name} - Business Photo` })}
                        >
                          {broker.businessPhotoUrl ? (
                            <img src={broker.businessPhotoUrl} alt="Business" className="w-full h-full object-cover" />
                          ) : (
                            <Building2 size={12} className="text-gray-300" />
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* View Details */}
                        <button
                          type="button"
                          onClick={() => setBrokerToView(broker)}
                          className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                          title="View complete details"
                        >
                          <Eye size={15} />
                        </button>

                        {canEdit && (
                          <>
                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => {
                                setBrokerToEdit(broker);
                                setShowAddModal(true);
                              }}
                              className="p-1.5 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                              title="Edit broker"
                            >
                              <Pencil size={15} />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(broker.id)}
                              className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Delete broker"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-6 py-3 bg-gray-50/70 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <div>
              Showing <span className="font-bold text-gray-800">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-bold text-gray-800">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{' '}
              <span className="font-bold text-gray-800">{totalItems}</span> brokers
            </div>

            <div className="flex items-center gap-2">
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>

              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronLeft size={15} />
              </button>

              <span className="font-bold px-2 text-gray-700">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedBrokers.map((broker) => (
            <div
              key={broker.id}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4"
            >
              {/* Card Top */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer"
                      onClick={() => broker.photoUrl && setImagePreview({ url: broker.photoUrl, title: `${broker.name} - Photo` })}
                    >
                      {broker.photoUrl ? (
                        <img src={broker.photoUrl} alt={broker.name} className="w-full h-full object-cover" />
                      ) : (
                        <User size={22} className="text-gray-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{broker.name}</h4>
                      <p className="text-[11px] text-gray-500 font-medium">
                        {broker.businessName || 'Independent Broker'}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    broker.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {broker.status}
                  </span>
                </div>

                {/* Details Badges */}
                <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">Project Type</span>
                    <span className="text-xs font-bold text-amber-800 truncate block" title={broker.projectType}>
                      {broker.projectType || '-'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">Deal Preferred</span>
                    <span className="text-xs font-bold text-emerald-800 truncate block" title={broker.dealPreferred}>
                      {broker.dealPreferred || '-'}
                    </span>
                  </div>
                </div>

                {/* Contact & Commission */}
                <div className="mt-3 flex items-center justify-between text-xs pt-2">
                  <div>
                    <a href={`tel:${broker.phone}`} className="font-bold text-gray-900 hover:text-indigo-600 block">
                      +91 {broker.phone}
                    </a>
                    <span className="text-[11px] text-gray-500 truncate block max-w-[160px]">{broker.email}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-indigo-700">
                      {broker.commissionPercentage != null ? broker.commissionPercentage : '0'}%
                    </span>
                    <span className="text-[10px] text-gray-400 block font-semibold uppercase">comm</span>
                  </div>
                </div>

                {/* RERA */}
                <div className="mt-2 text-[11px] font-mono bg-gray-50 p-1.5 rounded-md border border-gray-100 flex items-center justify-between">
                  <span className="text-gray-400 text-[10px] font-sans font-bold">RERA:</span>
                  <span className="font-bold text-gray-800 truncate max-w-[180px]">{broker.reraNo || '-'}</span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setBrokerToView(broker)}
                  className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  <Eye size={13} /> View Full Profile
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setBrokerToEdit(broker);
                      setShowAddModal(true);
                    }}
                    className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(broker.id)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Broker Modal */}
      <BrokerFormModal
        isOpen={showAddModal}
        initialData={brokerToEdit}
        onClose={() => {
          setShowAddModal(false);
          setBrokerToEdit(null);
        }}
        onSaved={loadData}
      />

      {/* Broker Details View Modal */}
      <BrokerDetailsModal
        isOpen={Boolean(brokerToView)}
        broker={brokerToView}
        onClose={() => setBrokerToView(null)}
        onEdit={canEdit ? (b) => {
          setBrokerToView(null);
          setBrokerToEdit(b);
          setShowAddModal(true);
        } : undefined}
      />

      {/* Image Lightbox Modal */}
      {imagePreview && (
        <div
          onClick={() => setImagePreview(null)}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-pointer animate-in fade-in"
        >
          <div className="relative max-w-3xl max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between text-white pb-2 px-1">
              <span className="text-xs font-bold">{imagePreview.title}</span>
              <button
                type="button"
                onClick={() => setImagePreview(null)}
                className="p-1 hover:bg-white/20 rounded-full transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <img
              src={imagePreview.url}
              alt="Enlarged"
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-5 max-w-sm w-full space-y-4 border border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Confirm Deletion</h3>
            <p className="text-xs text-gray-600">
              Are you sure you want to delete this broker record? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
              >
                Delete Broker
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
