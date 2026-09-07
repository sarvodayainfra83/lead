import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const calculateTotal = (rate, gst, discount, quantity) => {
  const basePrice = rate * quantity;
  const withDiscount = basePrice - (basePrice * (discount / 100));
  const withGst = withDiscount + (withDiscount * (gst / 100));
  return withGst;
};

export const calculateSubtotal = (items) => {
  return items.reduce((acc, item) => {
    const basePrice = item.rate * item.quantity;
    return acc + (basePrice - (basePrice * ((item.discountPercent || 0) / 100)));
  }, 0).toFixed(3);
};

export const calculateTotalGst = (items) => {
  return items.reduce((acc, item) => {
    const basePrice = item.rate * item.quantity;
    const withDiscount = basePrice - (basePrice * ((item.discountPercent || 0) / 100));
    return acc + (withDiscount * ((item.gstPercent || 0) / 100));
  }, 0).toFixed(3);
};

export const calculateGrandTotal = (items) => {
  const subtotal = parseFloat(calculateSubtotal(items));
  const gst = parseFloat(calculateTotalGst(items));
  return (subtotal + gst).toFixed(3);
};

export const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const formatDateTime = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  try {
    return d.toISOString();
  } catch (e) {
    return "";
  }
};

export const parseCustomDate = (dateStr) => {
  if (!dateStr) return new Date(NaN);
  return new Date(dateStr);
};
