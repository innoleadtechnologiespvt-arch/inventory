export interface User {
  username: string;
  role: string;
  full_name: string;
  token?: string;
}

export interface Product {
  product_id: number;
  product_name: string;
  sku: string;
  current_quantity: number;
  min_threshold: number;
  unit: string;
  is_low_stock?: number | boolean;
}

export interface StockInLog {
  entry_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity_added: number;
  date: string;
  batch_number: string | null;
  added_by: string;
  unit: string;
}

export interface StockOutLog {
  sale_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity_sold: number;
  customer_name: string;
  date: string;
  sold_by: string;
  unit: string;
}

export interface DashboardStats {
  totalSKUs: number;
  lowStockAlerts: number;
  totalInflow: number;
  totalOutflow: number;
}
