export type CatalogCategory = "todos" | string;

export type CatalogAvailabilityFilter =
  | "todos"
  | "disponible"
  | "pocas"
  | "no-disponible";

export type CatalogProduct = {
  id: string;
  productId?: string;
  name: string;
  category: string;
  tag: string;
  description: string;
  priceText: string;
  priceValue?: number;
  priceIncludesTax?: boolean;
  availability?: string;
  imageUrl?: string;
  categories?: string[];
  lastSyncedAt?: string;
};

export type CartItem = CatalogProduct & {
  quantity: number;
};

export type RouteResolveResponse = {
  route: {
    id: string;
    name: string;
    responsible?: string;
    coverage?: string[];
    customer_policy?: string;
  };
  status:
    | "route_active_now"
    | "route_upcoming"
    | "route_manual_review"
    | "route_unassigned"
    | "route_new_zone"
    | "route_unknown";
  calendar: {
    week_start: string;
    week_end: string;
    sales_window_start: string;
    sales_window_end: string;
    estimated_delivery_start: string;
    estimated_delivery_end: string;
    active_routes?: string[];
    cycle_position?: number;
  } | null;
  messages: {
    title: string;
    summary: string;
    detail: string;
  };
};

export type CustomerResolveResponse = {
  status:
    | "customer_key_required"
    | "customer_not_found"
    | "customer_identified"
    | "customer_route_unassigned"
    | "customer_route_review";
  customer: {
    id: string;
    ref: string;
    name: string;
    email?: string;
    phone?: string;
    route_tags: string[];
  } | null;
  route_resolution: RouteResolveResponse;
  messages: {
    title: string;
    summary: string;
    detail: string;
  };
};

export type CoverageResolveResponse = {
  status:
    | "coverage_location_required"
    | "coverage_unknown"
    | "coverage_active_now"
    | "coverage_upcoming";
  location: string;
  covered: boolean;
  route: RouteResolveResponse["route"] | null;
  calendar: RouteResolveResponse["calendar"];
  messages: RouteResolveResponse["messages"];
};
