export type PericiaSituacao = 'pendente' | 'marcada' | 'realizada' | 'cancelada';
export type ProfileRoleValue = 'pendente' | 'gerencia' | 'admin';
export type PeritoRelacao = 'ruim' | 'neutra' | 'boa' | 'otima';
export type PeritoResultado = 'negativo' | 'parcial' | 'positivo';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; nome: string; email: string; role: ProfileRoleValue; created_at: string };
        Insert: { id: string; nome?: string; email: string; role?: ProfileRoleValue };
        Update: Partial<{ nome: string; email: string; role: ProfileRoleValue }>;
        Relationships: [];
      };
      municipios: {
        Row: { id: number; nome: string; uf: string };
        Insert: { id: number; nome: string; uf: string };
        Update: Partial<{ nome: string; uf: string }>;
        Relationships: [];
      };
      processos: {
        Row: { id: number; numero: string; autor: string; reu: string; escritorio: string; created_at: string };
        Insert: { numero: string; autor: string; reu: string; escritorio: string };
        Update: Partial<{ numero: string; autor: string; reu: string; escritorio: string }>;
        Relationships: [];
      };
      peritos: {
        Row: {
          id: number; nome: string; contato: string; formacao: string; crea: string;
          documento: string; ja_trabalhamos: boolean; relacao: PeritoRelacao; resultados: PeritoResultado;
          created_at: string;
        };
        Insert: {
          nome: string; contato?: string; formacao?: string; crea?: string; documento?: string;
          ja_trabalhamos?: boolean; relacao?: PeritoRelacao; resultados?: PeritoResultado;
        };
        Update: Partial<Database['public']['Tables']['peritos']['Insert']>;
        Relationships: [];
      };
      colaboradores: {
        Row: { id: number; nome: string; contato: string; formacao: string; interno: boolean; created_at: string };
        Insert: { nome: string; contato?: string; formacao?: string; interno?: boolean };
        Update: Partial<Database['public']['Tables']['colaboradores']['Insert']>;
        Relationships: [];
      };
      pericias: {
        Row: {
          id: number; processo_id: number; data_agendada: string | null; hora_agendada: string | null;
          municipio_id: number; perito_id: number; colaborador_id: number | null;
          situacao: PericiaSituacao; observacoes: string | null; created_at: string;
        };
        Insert: {
          processo_id: number; data_agendada?: string | null; hora_agendada?: string | null; municipio_id: number;
          perito_id: number; colaborador_id?: number | null; situacao?: PericiaSituacao; observacoes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['pericias']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'pericias_processo_id_fkey';
            columns: ['processo_id'];
            isOneToOne: false;
            referencedRelation: 'processos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pericias_municipio_id_fkey';
            columns: ['municipio_id'];
            isOneToOne: false;
            referencedRelation: 'municipios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pericias_perito_id_fkey';
            columns: ['perito_id'];
            isOneToOne: false;
            referencedRelation: 'peritos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pericias_colaborador_id_fkey';
            columns: ['colaborador_id'];
            isOneToOne: false;
            referencedRelation: 'colaboradores';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      update_own_nome: { Args: { new_nome: string }; Returns: void };
    };
  };
};
