import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Building2,
  Shield,
  TrendingUp,
  Plus,
  Search,
  RotateCcw,
  Eye,
  Pencil,
  Trash2,
  Sparkles,
  CheckCircle2,
  XCircle,
  ImageIcon,
  Filter,
  Layers,
  MapPin,
  LayoutGrid,
  List,
  Calendar,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
  Mail
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { productApi } from '../../api/productApi';
import DataTable from '../../components/DataTable';
import ModalAlert from '../../components/ModalAlert';
import ProductFormModal from './ProductFormModal';
import ProductDetailModal from './ProductDetailModal';
import { WhatsAppIcon, shareOnWhatsApp, shareViaEmail } from '../../utils/productShare';

export default function Products() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState('real-estate'); // 'real-estate' | 'insurance' | 'mutual-funds'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' (card view) | 'table'
  const [loading, setLoading] = useState(true);

  // Data lists
  const [realEstateProducts, setRealEstateProducts] = useState([]);
  const [insuranceProducts, setInsuranceProducts] = useState([]);
  const [mutualFundProducts, setMutualFundProducts] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [featuredFilter, setFeaturedFilter] = useState('all'); // 'all' | 'featured'

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState(null);

  const [deleteAlert, setDeleteAlert] = useState({ isOpen: false, item: null });

  // Fetch all product catalogs
  const loadAllProducts = async () => {
    setLoading(true);
    try {
      const [reData, insData, mfData] = await Promise.all([
        productApi.getRealEstateProducts(),
        productApi.getInsuranceProducts(),
        productApi.getMutualFundProducts()
      ]);
      setRealEstateProducts(reData || []);
      setInsuranceProducts(insData || []);
      setMutualFundProducts(mfData || []);
    } catch (err) {
      console.error('Failed to load products:', err);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllProducts();
  }, []);

  const formatCurrency = (val) => {
    if (val === null || val === undefined || val === '') return '—';
    const strVal = String(val).trim();
    const num = Number(strVal.replace(/,/g, ''));
    if (!isNaN(num) && strVal !== '' && !strVal.toLowerCase().includes('lakh') && !strVal.toLowerCase().includes('cr')) {
      return `₹ ${num.toLocaleString('en-IN')}`;
    }
    return strVal.startsWith('₹') ? strVal : `₹ ${strVal}`;
  };

  // Filter products for active category and sort newest first
  const currentList = useMemo(() => {
    let list = [];
    if (activeTab === 'real-estate') list = realEstateProducts;
    else if (activeTab === 'insurance') list = insuranceProducts;
    else if (activeTab === 'mutual-funds') list = mutualFundProducts;

    const filtered = list.filter((item) => {
      // Status filter
      if (statusFilter === 'active' && !item.is_active) return false;
      if (statusFilter === 'inactive' && item.is_active) return false;

      // Featured filter
      if (featuredFilter === 'featured' && !item.is_featured) return false;

      // Exhaustive search across ANY and ALL column values
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();

        // Check formatted prices/numbers
        const priceStr = item.price ? formatCurrency(item.price).toLowerCase() : '';
        const covStr = item.coverage_amount ? formatCurrency(item.coverage_amount).toLowerCase() : '';
        const sipStr = item.min_sip_amount ? formatCurrency(item.min_sip_amount).toLowerCase() : '';
        if (priceStr.includes(q) || covStr.includes(q) || sipStr.includes(q)) return true;

        return Object.entries(item).some(([key, val]) => {
          if (key === 'id' || key === 'cover_image' || key === 'images') return false;
          if (val === null || val === undefined) return false;

          if (Array.isArray(val)) {
            return val.some(v => String(v).toLowerCase().includes(q));
          }
          if (typeof val === 'object') {
            return JSON.stringify(val).toLowerCase().includes(q);
          }
          return String(val).toLowerCase().includes(q);
        });
      }

      return true;
    });

    // Always sort newest data first
    return [...filtered].sort((a, b) => {
      const getTimestamp = (item) => {
        const timeStr = item.updated_at || item.created_at;
        if (timeStr) {
          const t = new Date(timeStr).getTime();
          if (!isNaN(t) && t > 0) return t;
        }
        const match = String(item.id || '').match(/\d{10,}/);
        if (match) return parseInt(match[0], 10);
        return 0;
      };

      const dateA = getTimestamp(a);
      const dateB = getTimestamp(b);

      if (dateB !== dateA) {
        return dateB - dateA; // Descending: newest first
      }

      // Prioritize items with actual content (real user listings) over blank seed rows
      const hasContentA = Boolean(a.title?.trim() || a.project_name || a.price || a.coverage_amount || a.min_sip_amount);
      const hasContentB = Boolean(b.title?.trim() || b.project_name || b.price || b.coverage_amount || b.min_sip_amount);
      if (hasContentB !== hasContentA) {
        return hasContentB ? 1 : -1;
      }

      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }, [activeTab, realEstateProducts, insuranceProducts, mutualFundProducts, statusFilter, featuredFilter, searchQuery]);

  // Pagination slice
  const totalPages = Math.ceil(currentList.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return currentList.slice(start, start + itemsPerPage);
  }, [currentList, currentPage, itemsPerPage]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setCurrentPage(1);
    setSearchQuery('');
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setFeaturedFilter('all');
    setCurrentPage(1);
  };

  // Actions
  const handleOpenAdd = () => {
    if (!isAdmin) {
      toast.error('Only administrators can add new products');
      return;
    }
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item) => {
    if (!isAdmin) {
      toast.error('Only administrators can edit products');
      return;
    }
    setEditingProduct(item);
    setIsFormOpen(true);
  };

  const handleOpenDetail = (item) => {
    setDetailProduct(item);
    setIsDetailOpen(true);
  };

  const confirmDelete = async () => {
    if (!isAdmin) {
      toast.error('Only administrators can delete products');
      return;
    }
    if (!deleteAlert.item) return;
    const { id } = deleteAlert.item;
    try {
      if (activeTab === 'real-estate') {
        await productApi.deleteRealEstateProduct(id);
      } else if (activeTab === 'insurance') {
        await productApi.deleteInsuranceProduct(id);
      } else if (activeTab === 'mutual-funds') {
        await productApi.deleteMutualFundProduct(id);
      }
      toast.success('Product deleted successfully');
      setDeleteAlert({ isOpen: false, item: null });
      loadAllProducts();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete product');
    }
  };


  // Table Headers
  const getTableHeaders = () => {
    if (activeTab === 'real-estate') {
      return ["Image", "Title & Project", "Property Type", "BHK & Area", "Price", "Facing & Floor", "Status", "Featured", "Actions"];
    }
    if (activeTab === 'insurance') {
      return ["Image", "Plan Title & Insurer", "Product Category", "Sub-Type", "Coverage Amount", "Premium", "Status", "Featured", "Actions"];
    }
    return ["Image", "Scheme Title", "Fund House", "Risk & Type", "Min SIP / Lumpsum", "1Y / 3Y Return", "Status", "Featured", "Actions"];
  };

  // Render Row for Desktop Table View
  const renderRow = (item, index) => {
    const thumbUrl = item.imagesList?.[0] || item.cover_image || null;

    return (
      <tr
        key={item.id || index}
        onClick={() => handleOpenDetail(item)}
        className="hover:bg-indigo-50/40 transition-colors border-b border-gray-100 text-xs cursor-pointer"
      >
        {/* Thumbnail */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <div className="w-12 h-10 rounded-lg overflow-hidden bg-slate-100 border border-gray-200 flex items-center justify-center mx-auto">
            {thumbUrl ? (
              <img
                src={thumbUrl}
                alt="thumb"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <ImageIcon size={16} className="text-gray-400" />
            )}
          </div>
        </td>

        {/* Real Estate Columns */}
        {activeTab === 'real-estate' && (
          <>
            <td className="px-4 py-3 font-semibold text-gray-900 max-w-xs">
              <div className="truncate font-bold text-gray-900" title={item.title || item.project_name || item.product_type}>
                {item.title?.trim() || item.project_name || item.product_type || 'Untitled Property'}
              </div>
              {item.project_name && (
                <div className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                  <span>{item.project_name}</span>
                  {item.builder_name && <span>· {item.builder_name}</span>}
                </div>
              )}
            </td>
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                {item.product_type || 'Apartment'}
              </span>
            </td>
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <span className="font-bold text-gray-800">{item.bhk || '—'}</span>
              <div className="text-[10px] text-gray-400">{item.area ? `${item.area} ${item.area_unit || 'sqft'}` : '—'}</div>
            </td>
            <td className="px-4 py-3 text-center whitespace-nowrap font-extrabold text-indigo-600">
              {formatCurrency(item.price)}
            </td>
            <td className="px-4 py-3 text-center whitespace-nowrap text-gray-600">
              <div>{item.facing || '—'}</div>
              <div className="text-[10px] text-gray-400">{item.floor_number !== null ? `Floor ${item.floor_number}` : ''}</div>
            </td>
          </>
        )}

        {/* Insurance Columns */}
        {activeTab === 'insurance' && (
          <>
            <td className="px-4 py-3 font-semibold text-gray-900 max-w-xs">
              <div className="truncate font-bold text-gray-900" title={item.title || item.insurer_name || item.insurance_sub_type}>
                {item.title?.trim() || item.insurer_name || item.insurance_sub_type || 'Untitled Plan'}
              </div>
              <div className="text-[11px] text-indigo-600 font-medium">{item.insurer_name}</div>
            </td>
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold">
                {item.product_type || 'Life Insurance'}
              </span>
            </td>
            <td className="px-4 py-3 text-center whitespace-nowrap font-medium text-gray-700">
              {item.insurance_sub_type || '—'}
            </td>
            <td className="px-4 py-3 text-center whitespace-nowrap font-extrabold text-emerald-600">
              {formatCurrency(item.coverage_amount)}
            </td>
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <span className="font-bold text-indigo-600">{formatCurrency(item.premium_amount)}</span>
              <span className="text-[10px] text-gray-400 block">/{item.premium_frequency || 'yr'}</span>
            </td>
          </>
        )}

        {/* Mutual Funds Columns */}
        {activeTab === 'mutual-funds' && (
          <>
            <td className="px-4 py-3 font-semibold text-gray-900 max-w-xs">
              <div className="truncate font-bold text-gray-900" title={item.title || item.scheme_name || item.fund_house}>
                {item.title?.trim() || item.scheme_name || item.fund_house || 'Untitled Fund'}
              </div>
              {item.scheme_name && <div className="text-[11px] text-gray-400 truncate">{item.scheme_name}</div>}
            </td>
            <td className="px-4 py-3 text-center whitespace-nowrap font-bold text-gray-800">
              {item.fund_house}
            </td>
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold block">
                {item.product_type || 'Equity'}
              </span>
              <span className="text-[10px] text-amber-600 font-semibold">{item.risk_level || 'Moderate'}</span>
            </td>
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <div className="font-bold text-gray-800">{formatCurrency(item.min_sip_amount)}</div>
              <span className="text-[10px] text-gray-400 block">{formatCurrency(item.min_investment)}</span>
            </td>
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <div className="font-bold text-emerald-600">{item.returns_1y ? `+${item.returns_1y}%` : '—'}</div>
              <span className="text-[10px] text-gray-400 block">{item.returns_3y ? `3Y: ${item.returns_3y}%` : ''}</span>
            </td>
          </>
        )}

        {/* Active Status */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.is_active
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
            {item.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>

        {/* Featured */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          {item.is_featured ? (
            <span className="inline-flex items-center gap-1 text-amber-500 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <Sparkles size={11} /> Featured
            </span>
          ) : (
            <span className="text-gray-300 text-xs">—</span>
          )}
        </td>

        {/* Action Buttons */}
        <td className="px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDetail(item);
              }}
              title="View Specifications"
              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition"
            >
              <Eye size={15} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                shareOnWhatsApp(item, activeTab);
              }}
              title="Share on WhatsApp"
              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition"
            >
              <WhatsAppIcon className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                shareViaEmail(item, activeTab);
              }}
              title="Share via Email"
              className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 border border-transparent hover:border-sky-100 transition"
            >
              <Mail size={15} />
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(item);
                  }}
                  title="Edit Product"
                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteAlert({ isOpen: true, item });
                  }}
                  title="Delete Product"
                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition"
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  // Render Card for Mobile / Simple Card View
  const renderCard = (item, index) => {
    const thumbUrl = item.imagesList?.[0] || item.cover_image || null;

    return (
      <div key={item.id || index} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 space-y-2.5">
        <div className="flex items-start gap-3">
          <div className="w-16 h-14 rounded-lg bg-slate-100 border border-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
            {thumbUrl ? (
              <img src={thumbUrl} alt="thumb" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon size={20} className="text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                {item.product_type}
              </span>
              {item.is_featured && (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-0.5">
                  <Sparkles size={10} /> Featured
                </span>
              )}
            </div>
            <h4 className="text-xs font-bold text-gray-900 truncate">
              {item.title?.trim() || item.project_name || item.insurer_name || item.fund_house || item.product_type || 'Untitled Product'}
            </h4>
            {activeTab === 'real-estate' && (
              <span className="text-[11px] text-gray-500 block truncate">{item.project_name || item.address || '—'}</span>
            )}
            {activeTab === 'insurance' && (
              <span className="text-[11px] text-gray-500 block truncate">{item.insurer_name} · {item.insurance_sub_type}</span>
            )}
            {activeTab === 'mutual-funds' && (
              <span className="text-[11px] text-gray-500 block truncate">{item.fund_house} · {item.scheme_name}</span>
            )}
          </div>
        </div>

        {/* Highlights */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-xs">
          <div>
            <span className="text-[10px] text-gray-400 block uppercase">
              {activeTab === 'real-estate' ? 'Price' : activeTab === 'insurance' ? 'Cover' : 'Min SIP'}
            </span>
            <span className="font-extrabold text-indigo-600">
              {activeTab === 'real-estate' ? formatCurrency(item.price) :
                activeTab === 'insurance' ? formatCurrency(item.coverage_amount) :
                  formatCurrency(item.min_sip_amount)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleOpenDetail(item)}
              className="p-1.5 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 text-xs font-semibold"
            >
              <Eye size={14} />
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => handleOpenEdit(item)}
                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteAlert({ isOpen: true, item })}
                  className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2.5 overflow-hidden">

      {/* Top Banner & Tab Switcher */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4 space-y-2.5 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Layers className="text-indigo-600" size={22} /> Products Catalog
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Grid vs Table View Mode Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-gray-200 text-xs">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${viewMode === 'grid'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
                  }`}
              >
                <LayoutGrid size={15} />
                <span>Cards</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${viewMode === 'table'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
                  }`}
              >
                <List size={15} />
                <span>Table</span>
              </button>
            </div>

            {/* Add Product Button (ADMIN ONLY) */}
            {isAdmin && (
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-200 transition font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 flex-shrink-0"
              >
                <Plus size={16} />
                <span>Add {activeTab === 'real-estate' ? 'Property' : activeTab === 'insurance' ? 'Insurance' : 'Mutual Fund'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pt-2 border-t border-gray-100 scrollbar-hide">
          <button
            onClick={() => handleTabChange('real-estate')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'real-estate'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'bg-slate-50 text-gray-600 hover:bg-slate-100'
              }`}
          >
            <Building2 size={16} />
            <span>Real Estate</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'real-estate' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
              {realEstateProducts.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('insurance')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'insurance'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'bg-slate-50 text-gray-600 hover:bg-slate-100'
              }`}
          >
            <Shield size={16} />
            <span>Insurance</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'insurance' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
              {insuranceProducts.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('mutual-funds')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'mutual-funds'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'bg-slate-50 text-gray-600 hover:bg-slate-100'
              }`}
          >
            <TrendingUp size={16} />
            <span>Mutual Funds</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'mutual-funds' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
              {mutualFundProducts.length}
            </span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2.5 sm:p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 flex-shrink-0">
        <div className="relative w-full sm:w-96 md:w-[450px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search anything (title, price, BHK, area, builder, RERA, insurer, returns, amenities...)"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 text-xs rounded-xl border border-gray-200 bg-slate-50/50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          <select
            value={featuredFilter}
            onChange={(e) => { setFeaturedFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 text-xs rounded-xl border border-gray-200 bg-slate-50/50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Listings</option>
            <option value="featured">Featured Only</option>
          </select>

          <button
            onClick={loadAllProducts}
            title="Refresh"
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center p-12 space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-gray-500">Loading products catalog...</span>
        </div>
      ) : viewMode === 'grid' ? (
        /* ================= CARD / CART VIEW ================= */
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          {/* Scrollable Card View Container */}
          <div
            className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300 scrollbar-track-transparent"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {currentList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center text-gray-400 text-xs">
                <Layers size={36} className="text-gray-300 mb-2" />
                No products found matching your search and filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-2">
                {paginatedData.map((item) => {
                  const thumbUrl = item.imagesList?.[0] || item.cover_image || null;
                  const displayTitle = item.title?.trim() || item.project_name || item.insurer_name || item.fund_house || item.product_type || 'Untitled Product';

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleOpenDetail(item)}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden group border-t-2 hover:-translate-y-1 cursor-pointer"
                    >
                      {/* Card Image Banner */}
                      <div className="relative aspect-[16/10] w-full bg-slate-100 overflow-hidden flex items-center justify-center">
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={displayTitle}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.parentElement?.querySelector('.no-image-placeholder');
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div
                          className="no-image-placeholder w-full h-full flex flex-col items-center justify-center text-gray-300 gap-1"
                          style={{ display: thumbUrl ? 'none' : 'flex' }}
                        >
                          <ImageIcon size={32} />
                          <span className="text-[10px] font-semibold text-gray-400">No Image</span>
                        </div>

                        {/* Top Badges Overlay */}
                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1 pointer-events-none">
                          <span className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-white font-bold text-[10px] uppercase tracking-wider">
                            {item.product_type}
                          </span>
                          <div className="flex items-center gap-1">
                            {item.is_featured && (
                              <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white font-bold text-[10px] shadow-sm flex items-center gap-1">
                                <Sparkles size={11} /> Featured
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-sm ${item.is_active
                              ? 'bg-emerald-600 text-white'
                              : 'bg-gray-700 text-white'
                              }`}>
                              {item.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>

                        {/* Price / Highlight Banner on Bottom of Image */}
                        <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white flex items-end justify-between">
                          <div>
                            <span className="text-[9px] text-gray-300 block uppercase font-medium">
                              {activeTab === 'real-estate' ? 'Price' : activeTab === 'insurance' ? 'Coverage Amount' : 'Min SIP Amount'}
                            </span>
                            <span className="text-base font-black tracking-tight drop-shadow">
                              {activeTab === 'real-estate' ? (item.price ? formatCurrency(item.price) : 'Price on Request') :
                                activeTab === 'insurance' ? (item.coverage_amount ? formatCurrency(item.coverage_amount) : 'Quote on Request') :
                                  (item.min_sip_amount ? formatCurrency(item.min_sip_amount) : 'Flexible SIP')}
                            </span>
                          </div>
                          {activeTab === 'insurance' && item.premium_amount && (
                            <div className="text-right">
                              <span className="text-[9px] text-gray-300 block uppercase font-medium">Premium</span>
                              <span className="text-xs font-bold text-amber-300">{formatCurrency(item.premium_amount)}</span>
                            </div>
                          )}
                          {activeTab === 'mutual-funds' && item.returns_1y !== null && item.returns_1y !== undefined && (
                            <div className="text-right">
                              <span className="text-[9px] text-gray-300 block uppercase font-medium">1Y Return</span>
                              <span className="text-xs font-bold text-emerald-300">+{item.returns_1y}%</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h3 className="font-bold text-sm text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition" title={displayTitle}>
                            {displayTitle}
                          </h3>

                          {/* Real Estate Specs */}
                          {activeTab === 'real-estate' && (
                            <div className="mt-2 space-y-2 text-xs">
                              {item.project_name && (
                                <div className="text-[11px] text-gray-500 font-medium truncate flex items-center gap-1">
                                  <Building2 size={13} className="text-indigo-500 flex-shrink-0" />
                                  <span>{item.project_name}</span>
                                  {item.builder_name && <span className="text-gray-400">· {item.builder_name}</span>}
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-1.5 py-1.5 px-2 bg-slate-50 rounded-xl border border-gray-100 text-[11px]">
                                <div>
                                  <span className="text-gray-400 block text-[9px] uppercase">Config</span>
                                  <span className="font-bold text-gray-800">{item.bhk || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400 block text-[9px] uppercase">Super Area</span>
                                  <span className="font-bold text-gray-800">{item.area ? `${item.area} ${item.area_unit || 'sqft'}` : '—'}</span>
                                </div>
                              </div>
                              {item.construction_status && (
                                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                                  <span>Status</span>
                                  <span className="font-semibold text-gray-800">{item.construction_status}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Insurance Specs */}
                          {activeTab === 'insurance' && (
                            <div className="mt-2 space-y-2 text-xs">
                              <div className="text-[11px] font-bold text-indigo-600 truncate flex items-center gap-1">
                                <Shield size={13} />
                                <span>{item.insurer_name}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5 py-1.5 px-2 bg-slate-50 rounded-xl border border-gray-100 text-[11px]">
                                <div>
                                  <span className="text-gray-400 block text-[9px] uppercase">Sub Type</span>
                                  <span className="font-bold text-gray-800 truncate block">{item.insurance_sub_type || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400 block text-[9px] uppercase">Claim Settlement</span>
                                  <span className="font-bold text-emerald-600">{item.claim_settlement_ratio ? `${item.claim_settlement_ratio}%` : '—'}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Mutual Funds Specs */}
                          {activeTab === 'mutual-funds' && (
                            <div className="mt-2 space-y-2 text-xs">
                              <div className="text-[11px] font-bold text-emerald-700 truncate flex items-center gap-1">
                                <TrendingUp size={13} />
                                <span>{item.fund_house}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5 py-1.5 px-2 bg-slate-50 rounded-xl border border-gray-100 text-[11px]">
                                <div>
                                  <span className="text-gray-400 block text-[9px] uppercase">Risk</span>
                                  <span className="font-bold text-amber-600">{item.risk_level || 'Moderate'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400 block text-[9px] uppercase">Expense Ratio</span>
                                  <span className="font-bold text-gray-800">{item.expense_ratio ? `${item.expense_ratio}%` : '—'}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Card Footer Actions */}
                        <div
                          className="pt-2 border-t border-gray-100 flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(item);
                            }}
                            className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1"
                          >
                            <Eye size={13} />
                            <span className="truncate">View</span>
                          </button>

                          {/* Share on WhatsApp */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              shareOnWhatsApp(item, activeTab);
                            }}
                            title="Share on WhatsApp"
                            className="p-1.5 rounded-xl text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition hover:scale-105 active:scale-95 flex items-center justify-center bg-white"
                          >
                            <WhatsAppIcon className="w-4 h-4 text-emerald-600" />
                          </button>

                          {/* Share via Email */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              shareViaEmail(item, activeTab);
                            }}
                            title="Share via Email"
                            className="p-1.5 rounded-xl text-sky-600 hover:bg-sky-50 border border-sky-200 transition hover:scale-105 active:scale-95 flex items-center justify-center bg-white"
                          >
                            <Mail size={15} />
                          </button>

                          {/* Admin Action Buttons */}
                          {isAdmin && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(item);
                                }}
                                title="Edit"
                                className="p-1.5 rounded-xl text-indigo-600 hover:bg-indigo-50 border border-indigo-100 transition"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteAlert({ isOpen: true, item });
                                }}
                                title="Delete"
                                className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-100 transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Grid View Pagination Footer - Always pinned inside card container above the footer */}
          <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-gray-600">
            <div className="flex items-center gap-3">
              <span>
                Showing <strong>{currentList.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to{' '}
                <strong>{Math.min(currentPage * itemsPerPage, currentList.length)}</strong> of{' '}
                <strong>{currentList.length}</strong> products
              </span>

              <div className="flex items-center gap-1.5 text-gray-500">
                <span>Per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="px-2 py-1 rounded-lg border border-gray-200 bg-slate-50 text-gray-700 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-bold text-gray-800">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================= TABLE VIEW ================= */
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <DataTable
            headers={getTableHeaders()}
            data={paginatedData}
            renderRow={renderRow}
            renderCard={renderCard}
            minWidth="1050px"
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            totalResults={currentList.length}
          />
        </div>
      )}

      {/* Modals */}
      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={loadAllProducts}
        category={activeTab}
        initialData={editingProduct}
      />

      <ProductDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        product={detailProduct}
        category={activeTab}
      />

      <ModalAlert
        isOpen={deleteAlert.isOpen}
        type="confirm"
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteAlert.item?.title}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onClose={() => setDeleteAlert({ isOpen: false, item: null })}
      />

    </div>
  );
}
