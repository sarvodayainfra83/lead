import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import DragScrollTable from './DragScrollTable';

/**
 * DataTable Component
 * Standardized table with Desktop Table View and Mobile Card View.
 * Includes integrated pagination footer.
 */
const DataTable = ({
  headers,
  data,
  renderRow,
  renderCard,
  minWidth = "1000px",
  stickyFirstColumn = false,
  stickyLastColumn = false,
  // Optional totals row(s) - one cell per header, or an array of such rows for multiple totals
  // sub-rows (e.g. one per Design/Execution/Actual). When provided, it replaces the pagination
  // footer with the bottom totals row(s) instead.
  totalRow,
  // Pagination Props
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  totalResults,
  totalItems,
  // View & Scroll Props
  disableDragScroll = false,
  viewMode = 'auto', // 'auto' | 'table' | 'cards'
  cardsGridClassName = "grid grid-cols-1 md:grid-cols-2 gap-3",
  // Loading state: spinner instead of rows on first load, light overlay while refreshing
  loading = false,
  loadingText = 'Loading data...'
}) => {
  const count = totalResults ?? totalItems ?? 0;
  // Normalize to a list of rows - accepts either a single flat row or an array of rows
  const totalRows = totalRow ? (Array.isArray(totalRow[0]) ? totalRow : [totalRow]) : null;

  const isCardsOnly = viewMode === 'cards';
  const isInitialLoading = loading && data.length === 0;

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-2.5 py-14">
      <div className="w-8 h-8 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">{loadingText}</p>
    </div>
  );
  const isTableOnly = viewMode === 'table';

  const renderTableContent = () => (
    <table className={`w-full relative border-collapse ${minWidth}`} style={totalRow ? { height: '100%' } : undefined}>
      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <tr>
          {headers.map((header, index) => {
            const isFirst = stickyFirstColumn && index === 0;
            const isLast = stickyLastColumn && index === headers.length - 1;
            return (
              <th
                key={index}
                className="px-3 py-2 text-center text-xs font-bold text-gray-900 whitespace-nowrap uppercase tracking-wider"
                style={{
                  ...(isFirst ? { position: 'sticky', left: 0, zIndex: 20, background: '#f9fafb', boxShadow: '2px 0 4px rgba(0,0,0,0.08)' } : {}),
                  ...(isLast  ? { position: 'sticky', right: 0, zIndex: 20, background: '#f9fafb', boxShadow: '-2px 0 4px rgba(0,0,0,0.08)' } : {}),
                }}
              >
                {header}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 bg-white">
        {data.map((item, index) => renderRow(item, index))}
        {data.length === 0 && !loading && (
          <tr>
            <td colSpan={headers.length} className="p-8 text-center text-gray-500 text-xs font-medium">No records found.</td>
          </tr>
        )}
      </tbody>
      {totalRow && (
        <tbody aria-hidden="true" style={{ height: '100%' }}>
          <tr style={{ height: '100%' }}>
            <td colSpan={headers.length} style={{ padding: 0, border: 'none' }} />
          </tr>
        </tbody>
      )}
      {totalRows && (
        <tfoot className="sticky bottom-0 z-10">
          {totalRows.map((row, rowIndex) => (
            <tr key={rowIndex} className={`bg-gray-100 ${rowIndex === 0 ? 'border-t-2 border-gray-300' : 'border-t border-gray-200'}`}>
              {row.map((cell, index) => (
                <td key={index} className="px-4 py-3 text-center text-sm font-bold text-gray-900 whitespace-nowrap">
                  {cell || cell === 0 ? cell : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tfoot>
      )}
    </table>
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-white relative">
      {/* Refreshing existing rows: keep them visible under a light overlay */}
      {loading && !isInitialLoading && (
        <div className="absolute inset-0 z-30 bg-white/60 backdrop-blur-[1px] flex items-start justify-center pt-16 pointer-events-none">
          <div className="flex items-center gap-2 bg-white border border-gray-200 shadow-sm rounded-full px-3 py-1.5">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-[11px] text-gray-600 font-semibold">{loadingText}</span>
          </div>
        </div>
      )}

      {/* First load: spinner in place of the table / cards */}
      {isInitialLoading && <div className="flex-1 min-h-0 flex items-center justify-center">{spinner}</div>}

      {/* Card View */}
      {!isInitialLoading && renderCard && !isTableOnly && (
        <div
          className={`${isCardsOnly ? 'flex flex-col' : 'md:hidden flex flex-col'} overflow-y-auto flex-1 bg-slate-50/50 p-2 sm:p-3 scrollbar-hide`}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {data.length > 0 ? (
            <div className={cardsGridClassName}>
              {data.map((item, index) => renderCard(item, index))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-100 shadow-sm text-xs font-medium">
              No records found.
            </div>
          )}
        </div>
      )}

      {/* Table View */}
      {!isInitialLoading && !isCardsOnly && (
        <div className={`${isTableOnly || !renderCard ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-h-0 overflow-hidden`}>
          {disableDragScroll ? (
            <div
              className="w-full flex-1 min-h-0 overflow-x-auto overflow-y-auto"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {renderTableContent()}
            </div>
          ) : (
            <DragScrollTable className="w-full flex-1 min-h-0">
              {renderTableContent()}
            </DragScrollTable>
          )}
        </div>
      )}

      {/* Footer - Unified for both views. Replaced by the totals row above when totalRow is provided. */}
      {!totalRow && (
        <div className="px-3 sm:px-4 py-1.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-2 sm:gap-4 rounded-b-lg flex-shrink-0 mt-auto">
          {/* Left Side: Row Dropdown */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:border-indigo-500 bg-white font-medium text-xs shadow-xs"
            >
              {[50, 100, 200, 300].map(val => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
            {count > 0 && (
              <>
                <span className="text-xs text-gray-500 font-medium sm:hidden">
                  ({count})
                </span>
                <span className="text-xs text-gray-500 whitespace-nowrap font-medium hidden sm:inline">
                  {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, count)} of {count}
                </span>
              </>
            )}
          </div>

          {/* Right Side: Pagination Controls */}
          <div className="flex items-center gap-1 sm:gap-2 text-gray-700">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1 border border-gray-300 rounded bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition shadow-xs flex items-center justify-center text-indigo-600"
            >
              <ChevronLeft size={14} strokeWidth={2.5} />
            </button>
            <div className="flex items-center text-xs font-bold text-gray-600 whitespace-nowrap px-1">
              {currentPage} / {totalPages || 1}
            </div>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1 border border-gray-300 rounded bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition shadow-xs flex items-center justify-center text-indigo-600"
            >
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
