export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      ahjs: {
        Row: {
          id: string
          name: string
          county: string | null
          zip: string | null
          classification: string | null
          address: string | null
          latitude: number | null
          longitude: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          county?: string | null
          zip?: string | null
          classification?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          county?: string | null
          zip?: string | null
          classification?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
