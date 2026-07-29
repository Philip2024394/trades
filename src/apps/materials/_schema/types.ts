// Materials Application Module · type definitions
// Mirrors the migration at supabase/migrations/20260728150000_nex_materials.sql
// Row types are named `*Row` when they reflect a Supabase row literally.

export type MaterialCategory =
  | "hardwood"
  | "softwood"
  | "modified"
  | "engineered"
  | "sheet"
  | "metal"
  | "glass"
  | "fastener"
  | "adhesive"
  | "finish"
  | "other";

export type SpeciesRow = {
  id:                    string;
  display_name:          string;
  category:              MaterialCategory;
  density_kg_m3:         number | null;
  janka_hardness_lbf:    number | null;
  notes:                 string | null;
  active:                boolean;
  created_at:            string;
};

export type SupplierRow = {
  id:              string;
  name:            string;
  contact_email:   string | null;
  contact_phone:   string | null;
  notes:           string | null;
  owner_id:        string;
  active:          boolean;
  created_at:      string;
  updated_at:      string;
  deleted_at:      string | null;
};

export type PackStatus =
  | "pending"
  | "measuring"
  | "complete"
  | "allocated"
  | "consumed"
  | "retired";

export type HardwoodPackRow = {
  id:                     string;
  pack_ref:               string;
  species_id:             string;
  supplier_id:            string | null;
  grade:                  string | null;
  board_count_expected:   number | null;
  purchase_date:          string | null;
  purchase_reference:     string | null;
  cost_at_purchase:       number | null;
  cost_currency:          string;
  notes:                  string | null;
  status:                 PackStatus;
  owner_id:               string;
  created_by:             string;
  created_at:             string;
  updated_at:             string;
  deleted_at:             string | null;
};

export type BoardStatus =
  | "awaiting_measurement"
  | "measured"
  | "allocated"
  | "machined"
  | "installed"
  | "offcut"
  | "disposed";

export type HardwoodBoardRow = {
  id:                       string;
  pack_id:                  string;
  board_ref:                string;
  position_in_pack:         number;
  status:                   BoardStatus;
  current_measurement_id:   string | null;
  created_at:               string;
  updated_at:               string;
  deleted_at:               string | null;
};

export type MeasuredByKind = "user" | "worker_link";

export type BoardMeasurementRow = {
  id:                     string;
  board_id:               string;
  measurement_version:    number;
  is_current:             boolean;
  length_mm:              number;
  width_end_a_mm:         number;
  width_centre_mm:        number;
  width_end_b_mm:         number;
  thickness_end_a_mm:     number;
  thickness_centre_mm:    number;
  thickness_end_b_mm:     number;
  moisture_content_pct:   number | null;
  photo_url:              string | null;
  notes:                  string | null;
  measured_by_kind:       MeasuredByKind;
  measured_by_ref:        string;
  measured_at:            string;
  created_at:             string;
};

export type DefectType = "knot" | "split" | "cup" | "twist" | "bow" | "sap" | "other";
export type DefectSeverity = "minor" | "moderate" | "severe";

export type BoardDefectRow = {
  id:                string;
  board_id:          string;
  defect_type:       DefectType;
  severity:          DefectSeverity;
  location:          string | null;
  notes:             string | null;
  observed_by_kind:  MeasuredByKind;
  observed_by_ref:   string;
  observed_at:       string;
  created_at:        string;
};

export type WorkerLinkRow = {
  id:                string;
  token:             string;
  pack_id:           string;
  label:             string | null;
  created_by:        string;
  expires_at:        string | null;
  revoked_at:        string | null;
  revoke_reason:     string | null;
  max_uses:          number | null;
  current_uses:      number;
  last_used_at:      string | null;
  last_ip:           string | null;
  last_user_agent:   string | null;
  created_at:        string;
};

export type AllocationRow = {
  id:                string;
  board_id:          string;
  project_ref:       string;
  portion_mm3:       number | null;
  allocated_at:      string;
  allocated_by:      string;
  released_at:       string | null;
  released_by:       string | null;
  released_reason:   string | null;
  notes:             string | null;
};

export type OffcutStatus = "available" | "allocated" | "disposed";

export type OffcutRow = {
  id:                              string;
  parent_board_id:                 string;
  offcut_ref:                      string;
  length_mm:                       number;
  width_mm:                        number;
  thickness_mm:                    number;
  status:                          OffcutStatus;
  created_from_measurement_id:     string | null;
  notes:                           string | null;
  created_by:                      string;
  created_at:                      string;
  updated_at:                      string;
};

export type AuditActorKind = "user" | "worker_link" | "system";

export type AuditLogRow = {
  id:            string;
  entity_type:   string;
  entity_id:     string;
  event_type:    string;
  actor_kind:    AuditActorKind;
  actor_ref:     string;
  before_json:   unknown | null;
  after_json:    unknown | null;
  metadata:      Record<string, unknown>;
  occurred_at:   string;
};

// ─── Composite / derived types ────────────────────────────────────

export type BoardWithCurrentMeasurement = HardwoodBoardRow & {
  current_measurement: BoardMeasurementRow | null;
  defects: BoardDefectRow[];
};

export type PackWithBoards = HardwoodPackRow & {
  species: SpeciesRow;
  supplier: SupplierRow | null;
  boards: BoardWithCurrentMeasurement[];
  worker_links: WorkerLinkRow[];
};

export type BoardVolume = {
  board_id: string;
  volume_mm3: number;
  volume_m3: number;
  volume_board_feet: number;
  from_measurement_id: string;
};

export type StockSummaryRow = {
  species_id: string;
  species_display_name: string;
  pack_count: number;
  board_count: number;
  measured_board_count: number;
  awaiting_measurement_count: number;
  allocated_count: number;
  offcut_count: number;
  total_volume_m3: number;
};

// ─── Provider-agnostic errors ─────────────────────────────────────

export type MaterialsErrorCode =
  | "not_found"
  | "unauthorised"
  | "forbidden"
  | "invalid_input"
  | "conflict"
  | "worker_link_revoked"
  | "worker_link_expired"
  | "worker_link_exhausted"
  | "pack_deleted"
  | "board_deleted"
  | "measurement_immutable"
  | "internal";

export class MaterialsError extends Error {
  readonly code: MaterialsErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: MaterialsErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "MaterialsError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
