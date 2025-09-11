// backend/src/types/index.ts
import { Request, Response, NextFunction } from 'express';

// =====================================
// 基本型・共通型
// =====================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: any[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// =====================================
// 認証・ユーザー関連型
// =====================================

export interface JWTPayload {
  id: string;
  userId: string;
  username: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;  // オプショナルに変更
}

// Express.RequestHandlerと完全互換の型定義
export type AuthenticatedRequestHandler = (
  req: Request & { user?: JWTPayload },
  res: Response,
  next: NextFunction
) => void | Promise<void>;

// ミドルウェア用の型定義
export type AuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// =====================================
// Enum型定義（Prismaスキーマに基づく）
// =====================================

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  DRIVER = 'DRIVER'
}

export enum VehicleStatus {
  ACTIVE = 'ACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  INACTIVE = 'INACTIVE',
  RETIRED = 'RETIRED'
}

export enum FuelType {
  GASOLINE = 'GASOLINE',
  DIESEL = 'DIESEL',
  HYBRID = 'HYBRID',
  ELECTRIC = 'ELECTRIC'
}

export enum LocationType {
  LOADING = 'LOADING',
  UNLOADING = 'UNLOADING',
  BOTH = 'BOTH'
}

export enum MaintenanceType {
  ROUTINE = 'ROUTINE',
  REPAIR = 'REPAIR',
  INSPECTION = 'INSPECTION',
  EMERGENCY = 'EMERGENCY'
}

export enum OperationStatus {
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum InputType {
  CHECKBOX = 'CHECKBOX',
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  SELECT = 'SELECT'
}

export enum InspectionStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED'
}

export enum InspectionType {
  PRE_TRIP = 'PRE_TRIP',
  POST_TRIP = 'POST_TRIP',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY'
}

// =====================================
// User関連型
// =====================================

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  name: string;
  role?: UserRole;
  employee_id?: string;
  phone?: string;
  is_active: boolean;
  last_login_at?: Date;
  password_changed_at?: Date;
  created_at: Date;
  updated_at: Date;
  audit_logs?: any[]; // 関連するAuditLogの配列
  inspection_item_results?: any[]; // 関連するInspectionItemResultの配列
  inspection_items?: any[]; // 関連するInspectionItemの配列
  inspection_records?: any[]; // 関連するInspectionRecordの配列
  maintenance_records?: any[]; // 関連するMaintenanceRecordの配列
  notifications?: any[]; // 関連するNotificationの配列
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password_hash: string;
  name: string;
  role?: UserRole;
  employee_id?: string;
  phone?: string;
}

export interface UpdateUserRequest {
  username: string;
  email: string;
  password_hash: string;
  name: string;
  role?: UserRole;
  employee_id?: string;
  phone?: string;
  is_active?: boolean;
}

// =====================================
// Vehicle関連型
// =====================================

export interface Vehicle {
  id: string;
  plate_number: string;
  manufacturer?: string;
  model?: string;
  year?: number;
  fuel_type?: FuelType;
  capacity_tons?: number;
  current_mileage?: number;
  status?: VehicleStatus;
  purchase_date?: Date;
  insurance_expiry?: Date;
  inspection_expiry?: Date;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateVehicleRequest {
  plate_number: string;
  manufacturer?: string;
  model?: string;
  year?: number;
  fuel_type?: FuelType;
  capacity_tons?: number;
  purchase_date?: Date;
  insurance_expiry?: Date;
  inspection_expiry?: Date;
  notes?: string;
}

export interface UpdateVehicleRequest {
  plate_number?: string;
  manufacturer?: string;
  model?: string;
  year?: number;
  fuel_type?: FuelType;
  capacity_tons?: number;
  current_mileage?: number;
  status?: VehicleStatus;
  purchase_date?: Date;
  insurance_expiry?: Date;
  inspection_expiry?: Date;
  notes?: string;
}

export interface VehicleFilter extends PaginationQuery {
  search?: string;
  status?: VehicleStatus;
  fuel_type?: FuelType;
}

// =====================================
// Item関連型
// =====================================

export interface Item {
  id: string;
  name: string;
  category?: string;
  unit?: string;
  standard_weight_tons?: number;
  hazardous?: boolean;
  description?: string;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateItemRequest {
  name: string;
  category?: string;
  unit?: string;
  standard_weight_tons?: number;
  hazardous?: boolean;
  description?: string;
}

export interface UpdateItemRequest {
  name?: string;
  category?: string;
  unit?: string;
  standard_weight_tons?: number;
  hazardous?: boolean;
  description?: string;
  is_active?: boolean;
}

// =====================================
// Location関連型
// =====================================

export interface Location {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  location_type: LocationType;
  client_name?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  operating_hours?: string;
  special_instructions?: string;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateLocationRequest {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  location_type: LocationType;
  client_name?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  operating_hours?: string;
  special_instructions?: string;
}

export interface UpdateLocationRequest {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  location_type?: LocationType;
  client_name?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  operating_hours?: string;
  special_instructions?: string;
  is_active?: boolean;
}

// =====================================
// Trip関連型
// =====================================

export interface Trip {
  id: string;
  driverId: string;
  vehicleId: string;
  operationId?: string;
  startTime: Date;
  endTime?: Date;
  status: string;
  startLatitude?: number;
  startLongitude?: number;
  endLatitude?: number;
  endLongitude?: number;
  distance?: number;
  fuelConsumed?: number;
  fuelCost?: number;
  notes?: string;
  weatherCondition?: string;
  roadCondition?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTripRequest {
  driverId: string;
  vehicleId: string;
  operationId?: string;
  startLatitude?: number;
  startLongitude?: number;
  notes?: string;
  weatherCondition?: string;
}

export interface UpdateTripRequest {
  endTime?: Date;
  status?: string;
  endLatitude?: number;
  endLongitude?: number;
  distance?: number;
  fuelConsumed?: number;
  fuelCost?: number;
  notes?: string;
  weatherCondition?: string;
  roadCondition?: string;
}

export interface CreateTripDetailRequest {
  activityType: string;
  locationId: string;
  itemId: string;
  plannedTime?: Date;
  plannedWeight?: number;
  notes?: string;
}

export interface UpdateTripDetailRequest {
  actualStartTime?: Date;
  actualEndTime?: Date;
  actualWeight?: number;
  status?: string;
  notes?: string;
}

export interface TripDetail {
  id: string;
  tripId: string;
  activityType: string;
  locationId: string;
  itemId: string;
  plannedTime?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  plannedWeight?: number;
  actualWeight?: number;
  status?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================
// Operation関連型
// =====================================

export interface Operation {
  id: string;
  operation_number: string;
  driver_id: string;
  vehicle_id: string;
  status: OperationStatus;
  planned_start_time?: Date;
  actual_start_time?: Date;
  actual_end_time?: Date;
  start_mileage?: number;
  end_mileage?: number;
  total_distance_km?: number;
  total_weight_tons?: number;
  fuel_consumed_liters?: number;
  fuel_cost_yen?: number;
  weather_condition?: string;
  road_condition?: string;
  notes?: string;
  created_by?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateOperationRequest {
  driver_id: string;
  vehicle_id: string;
  planned_start_time?: Date;
  notes?: string;
}

export interface UpdateOperationRequest {
  status?: OperationStatus;
  actual_start_time?: Date;
  actual_end_time?: Date;
  start_mileage?: number;
  end_mileage?: number;
  total_distance_km?: number;
  total_weight_tons?: number;
  fuel_consumed_liters?: number;
  fuel_cost_yen?: number;
  weather_condition?: string;
  road_condition?: string;
  notes?: string;
}

// =====================================
// Operation Detail関連型
// =====================================

export interface OperationDetail {
  id: string;
  operation_id: string;
  sequence_number: number;
  activity_type: string;
  location_id: string;
  item_id: string;
  planned_time?: Date;
  actual_start_time?: Date;
  actual_end_time?: Date;
  planned_weight_tons?: number;
  actual_weight_tons?: number;
  status?: string;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateOperationDetailRequest {
  operation_id: string;
  sequence_number: number;
  activity_type: string;
  location_id: string;
  item_id: string;
  planned_time?: Date;
  planned_weight_tons?: number;
  notes?: string;
}

export interface UpdateOperationDetailRequest {
  actual_start_time?: Date;
  actual_end_time?: Date;
  actual_weight_tons?: number;
  status?: string;
  notes?: string;
}

// =====================================
// Inspection関連型
// =====================================

export interface InspectionItem {
  id: string;
  name: string;
  description?: string;
  inspection_type: InspectionType;
  input_type: InputType;
  category?: string;
  is_required: boolean;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface InspectionRecord {
  id: string;
  vehicle_id: string;
  inspector_id: string;
  operation_id?: string;
  inspection_type: InspectionType;
  status: InspectionStatus;
  started_at?: Date;
  completed_at?: Date;
  overall_result?: boolean;
  overall_notes?: string;
  defects_found?: number;
  latitude?: number;
  longitude?: number;
  location_name?: string;
  weather_condition?: string;
  temperature?: number;
  created_at: Date;
  updated_at: Date;
}

export interface InspectionItemResult {
  id: string;
  inspection_record_id: string;
  inspection_item_id: string;
  result_value?: string;
  is_passed?: boolean;
  notes?: string;
  defect_level?: string;
  photo_urls: string[];
  attachment_urls: string[];
  checked_at: Date;
  checked_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateInspectionItemRequest {
  name: string;
  description?: string;
  inspection_type: InspectionType;
  input_type?: InputType;
  category?: string;
  is_required?: boolean;
  display_order?: number;
}

export interface UpdateInspectionItemRequest {
  name?: string;
  description?: string;
  inspection_type?: InspectionType;
  input_type?: InputType;
  category?: string;
  is_required?: boolean;
  display_order?: number;
  is_active?: boolean;
}

export interface CreateInspectionRecordRequest {
  vehicle_id: string;
  inspector_id: string;
  operation_id?: string;
  inspection_type: InspectionType;
  latitude?: number;
  longitude?: number;
  location_name?: string;
  weather_condition?: string;
  temperature?: number;
}

export interface UpdateInspectionRecordRequest {
  status?: InspectionStatus;
  completed_at?: Date;
  overall_result?: boolean;
  overall_notes?: string;
  defects_found?: number;
}

export interface CreateInspectionItemResultRequest {
  inspection_record_id: string;
  inspection_item_id: string;
  result_value?: string;
  is_passed?: boolean;
  notes?: string;
  defect_level?: string;
  photo_urls?: string[];
  attachment_urls?: string[];
  checked_by?: string;
}

export interface UpdateInspectionItemResultRequest {
  result_value?: string;
  is_passed?: boolean;
  notes?: string;
  defect_level?: string;
  photo_urls?: string[];
  attachment_urls?: string[];
}

// =====================================
// Maintenance関連型
// =====================================

export interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  maintenance_type: MaintenanceType;
  scheduled_date?: Date;
  completed_date?: Date;
  mileage_at_maintenance?: number;
  cost?: number;
  vendor_name?: string;
  description?: string;
  next_maintenance_date?: Date;
  next_maintenance_mileage?: number;
  is_completed?: boolean;
  created_by?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateMaintenanceRecordRequest {
  vehicle_id: string;
  maintenance_type: MaintenanceType;
  scheduled_date?: Date;
  mileage_at_maintenance?: number;
  cost?: number;
  vendor_name?: string;
  description?: string;
  next_maintenance_date?: Date;
  next_maintenance_mileage?: number;
}

export interface UpdateMaintenanceRecordRequest {
  scheduled_date?: Date;
  completed_date?: Date;
  mileage_at_maintenance?: number;
  cost?: number;
  vendor_name?: string;
  description?: string;
  next_maintenance_date?: Date;
  next_maintenance_mileage?: number;
  is_completed?: boolean;
}

// =====================================
// GPS関連型
// =====================================

export interface GPSLog {
  id: string;
  vehicle_id: string;
  operation_id?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed_kmh?: number;
  heading?: number;
  accuracy_meters?: number;
  recorded_at: Date;
  created_at?: Date;
}

export interface CreateGPSLogRequest {
  vehicle_id: string;
  operation_id?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed_kmh?: number;
  heading?: number;
  accuracy_meters?: number;
  recorded_at: Date;
}

// =====================================
// Filter型（各種検索・フィルタリング用）
// =====================================

export interface BaseFilter extends PaginationQuery {
  search?: string;
  is_active?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface UserFilter extends BaseFilter {
  role?: UserRole;
}

export interface ItemFilter extends BaseFilter {
  category?: string;
  hazardous?: boolean;
}

export interface LocationFilter extends BaseFilter {
  location_type?: LocationType;
  client_name?: string;
}

export interface OperationFilter extends BaseFilter {
  driver_id?: string;
  vehicle_id?: string;
  status?: OperationStatus;
  date_from?: Date;
  date_to?: Date;
}

export interface InspectionFilter extends BaseFilter {
  inspection_type?: InspectionType;
  vehicle_id?: string;
  inspector_id?: string;
  status?: InspectionStatus;
  date_from?: Date;
  date_to?: Date;
}

export interface MaintenanceFilter extends BaseFilter {
  vehicle_id?: string;
  maintenance_type?: MaintenanceType;
  is_completed?: boolean;
  date_from?: Date;
  date_to?: Date;
}

// =====================================
// Notification関連型
// =====================================

export interface Notification {
  id: string;
  user_id?: string;
  title?: string;
  message?: string;
  is_read?: boolean;
}

export interface CreateNotificationRequest {
  user_id?: string;
  title?: string;
  message?: string;
}

// =====================================
// System Settings関連型
// =====================================

export interface SystemSetting {
  key: string;
  value?: string;
  description?: string;
}

export interface UpdateSystemSettingRequest {
  value?: string;
  description?: string;
}

// =====================================
// Audit Log関連型
// =====================================

export interface AuditLog {
  id: string;
  table_name: string;
  operation_type: string;
  record_id?: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  old_values?: any;
  new_values?: any;
  created_at?: Date;
}

// =====================================
// Statistics・レポート関連型
// =====================================

export interface DashboardStats {
  totalVehicles: number;
  activeVehicles: number;
  totalDrivers: number;
  activeOperations: number;
  todayOperations: number;
  maintenanceAlerts: number;
  inspectionAlerts: number;
}

export interface VehicleStats {
  totalDistance: number;
  totalOperations: number;
  fuelConsumption: number;
  averageSpeed: number;
  maintenanceAlerts: number;
  lastInspection?: Date;
}

export interface DriverStats {
  totalOperations: number;
  totalDistance: number;
  averageOperationTime: number;
  safetyScore: number;
  lastOperation?: Date;
}

// =====================================
// Error・Validation関連型
// =====================================

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: ValidationError[];
  statusCode: number;
}