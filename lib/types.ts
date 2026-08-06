// Tipos compartidos del dominio SECOP.

/**
 * Registro crudo tal como lo devuelve la SODA API de SECOP II
 * (dataset jbjy-vk9h). Todos los campos llegan como string; solo
 * declaramos los que consumimos. `urlproceso` es un objeto anidado.
 */
export interface SecopRawContract {
  id_contrato?: string;
  proveedor_adjudicado?: string;
  documento_proveedor?: string;
  tipodocproveedor?: string;
  nombre_entidad?: string;
  nit_entidad?: string;
  objeto_del_contrato?: string;
  descripcion_del_proceso?: string;
  valor_del_contrato?: string;
  fecha_de_inicio_del_contrato?: string;
  fecha_de_fin_del_contrato?: string;
  fecha_de_firma?: string;
  modalidad_de_contratacion?: string;
  tipo_de_contrato?: string;
  estado_contrato?: string;
  urlproceso?: { url?: string };
  departamento?: string;
  ciudad?: string;
  orden?: string;
  nombre_representante_legal?: string;
  identificaci_n_representante_legal?: string;
  domicilio_representante_legal?: string;
  [key: string]: unknown;
}

/**
 * Fila lista para insertar/actualizar en la tabla `contracts` de Supabase.
 * Las claves coinciden exactamente con las columnas de la tabla.
 */
export interface ContractRow {
  secop_id: string;
  contractor_name: string | null;
  contractor_id: string | null;
  contractor_doc_type: string | null;
  entity_name: string | null;
  entity_nit: string | null;
  contract_object: string | null;
  contract_value: number | null;
  start_date: string | null;
  end_date: string | null;
  signing_date: string | null;
  selection_method: string | null;
  contract_type: string | null;
  contract_status: string | null;
  secop_url: string | null;
  department: string | null;
  city: string | null;
  entity_order: string | null;
  legal_rep_name: string | null;
  legal_rep_id: string | null;
  legal_rep_address: string | null;
  raw_data: SecopRawContract;
}

export type SyncStatus = "success" | "partial" | "failed";
