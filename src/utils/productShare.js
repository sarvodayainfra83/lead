import React from 'react';
import toast from 'react-hot-toast';

export const WhatsAppIcon = ({ className = 'w-4 h-4', size = 16 }) =>
  React.createElement(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: size,
      height: size,
      className,
      fill: 'currentColor'
    },
    React.createElement('path', {
      d: 'M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.043.072.043.419-.101.824zm-3.392-12.416c-5.514 0-10 4.486-10 10 0 1.761.459 3.417 1.261 4.862l-1.292 4.722 4.841-1.269c1.401.767 3.003 1.185 4.706 1.185 5.514 0 10-4.486 10-10s-4.486-10-10-10z'
    })
  );

const formatSharePrice = (val) => {
  if (val === null || val === undefined || val === '') return 'Price on Request';
  const strVal = String(val).trim();
  const num = Number(strVal.replace(/,/g, ''));
  if (!isNaN(num) && strVal !== '' && !strVal.toLowerCase().includes('lakh') && !strVal.toLowerCase().includes('cr')) {
    return `₹ ${num.toLocaleString('en-IN')}`;
  }
  return strVal.startsWith('₹') ? strVal : `₹ ${strVal}`;
};

export const formatProductShareData = (item, category = 'real-estate') => {
  const isRealEstate = category === 'real-estate';
  const isInsurance = category === 'insurance';
  const isMutualFund = category === 'mutual-funds';

  const title = item.title?.trim() || item.project_name || item.scheme_name || item.insurer_name || 'Product Details';
  const lines = [];

  lines.push(`🌟 *${title}*`);
  lines.push('');

  if (isRealEstate) {
    if (item.project_name) lines.push(`🏢 *Project:* ${item.project_name}`);
    if (item.product_type) lines.push(`🏷️ *Property Type:* ${item.product_type}`);
    if (item.bhk) lines.push(`🛏️ *Configuration:* ${item.bhk}`);
    if (item.price) lines.push(`💰 *Price:* ${formatSharePrice(item.price)}`);
    if (item.area) lines.push(`📐 *Super Area:* ${item.area} ${item.area_unit || 'sqft'}`);
    if (item.carpet_area) lines.push(`📏 *Carpet Area:* ${item.carpet_area} sqft`);
    if (item.floor_number) lines.push(`🏢 *Floor:* ${item.floor_number} of ${item.total_floors || 'N/A'}`);
    if (item.facing) lines.push(`🧭 *Facing:* ${item.facing}`);
    if (item.construction_status) lines.push(`🏗️ *Status:* ${item.construction_status}`);
    if (item.possession_date) lines.push(`📅 *Possession Date:* ${item.possession_date}`);
    if (item.builder_name) lines.push(`👷 *Builder:* ${item.builder_name}`);
    if (item.rera_number) lines.push(`📜 *RERA No:* ${item.rera_number}`);
    if (item.address) lines.push(`📍 *Location:* ${item.address}`);
    if (item.amenities) {
      const am = Array.isArray(item.amenities) ? item.amenities.join(', ') : item.amenities;
      lines.push(`✨ *Amenities:* ${am}`);
    }
  } else if (isInsurance) {
    if (item.insurer_name) lines.push(`🏢 *Insurer:* ${item.insurer_name}`);
    if (item.product_type) lines.push(`🏷️ *Category:* ${item.product_type}`);
    if (item.insurance_sub_type) lines.push(`📋 *Plan Type:* ${item.insurance_sub_type}`);
    if (item.coverage_amount) lines.push(`🛡️ *Coverage (Sum Assured):* ${formatSharePrice(item.coverage_amount)}`);
    if (item.premium_amount) lines.push(`💵 *Premium:* ${formatSharePrice(item.premium_amount)} / ${item.premium_frequency || 'yr'}`);
    if (item.policy_term) lines.push(`⏳ *Policy Term:* ${item.policy_term} ${item.policy_term_unit || 'Years'}`);
    if (item.entry_age_min || item.entry_age_max) {
      lines.push(`👥 *Entry Age:* ${item.entry_age_min || '18'} to ${item.entry_age_max || '65'} Yrs`);
    }
    if (item.claim_settlement_ratio) lines.push(`📊 *Claim Settlement Ratio:* ${item.claim_settlement_ratio}%`);
    if (item.benefits) {
      const ben = Array.isArray(item.benefits) ? item.benefits.join(', ') : item.benefits;
      lines.push(`🌟 *Key Benefits:* ${ben}`);
    }
  } else if (isMutualFund) {
    if (item.fund_house) lines.push(`🏛️ *Fund House:* ${item.fund_house}`);
    if (item.scheme_name) lines.push(`📈 *Scheme:* ${item.scheme_name}`);
    if (item.product_type) lines.push(`🏷️ *Category:* ${item.product_type}`);
    if (item.risk_level) lines.push(`⚠️ *Risk Level:* ${item.risk_level}`);
    if (item.min_sip_amount) lines.push(`🔄 *Min SIP:* ${formatSharePrice(item.min_sip_amount)}`);
    if (item.min_investment) lines.push(`💳 *Min Lump Sum:* ${formatSharePrice(item.min_investment)}`);
    if (item.expense_ratio) lines.push(`📊 *Expense Ratio:* ${item.expense_ratio}%`);
    if (item.benchmark) lines.push(`🎯 *Benchmark:* ${item.benchmark}`);
    if (item.returns_1y || item.returns_3y || item.returns_5y) {
      lines.push(`🚀 *Historical Returns:* 1Y: ${item.returns_1y || '-'}% | 3Y: ${item.returns_3y || '-'}% | 5Y: ${item.returns_5y || '-'}%`);
    }
  }

  if (item.description) {
    lines.push('');
    lines.push(`📝 *Overview:*`);
    lines.push(item.description);
  }

  const thumbUrl = item.imagesList?.[0] || item.cover_image;
  if (thumbUrl && (thumbUrl.startsWith('http://') || thumbUrl.startsWith('https://'))) {
    lines.push('');
    lines.push(`🖼️ *Image Gallery / Preview:* ${thumbUrl}`);
  }

  lines.push('');
  lines.push(`— Shared from Sarvodaya Infracon —`);

  return {
    subject: `${title} - Sarvodaya Infracon`,
    text: lines.join('\n')
  };
};

export const shareOnWhatsApp = (item, category) => {
  const { text } = formatProductShareData(item, category);
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
  toast.success('Opening WhatsApp...');
};

export const shareViaEmail = (item, category) => {
  const { subject, text } = formatProductShareData(item, category);
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  window.location.href = mailtoUrl;
  toast.success('Opening Email client...');
};
