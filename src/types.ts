export interface Student {
  id: string;
  student_name: string;
  class: string;
  schoolEmail: string;
}

export interface HabitRecord {
  id: string;
  student_name: string;
  class: string;
  date: string;
  wake_time?: string;
  prayer_subuh?: boolean;
  prayer_dhuhur?: boolean;
  prayer_ashar?: boolean;
  prayer_maghrib?: boolean;
  prayer_isya?: boolean;
  dta?: boolean;
  non_muslim_pagi?: boolean;
  non_muslim_malam?: boolean;
  non_muslim_kitab?: boolean;
  non_muslim_mingguan?: boolean;
  non_muslim_keluarga?: boolean;
  non_muslim_lainnya?: boolean;
  is_non_muslim?: boolean;
  exercise?: boolean;
  exercise_type?: string;
  healthy_food?: boolean;
  food_menu?: string;
  study_duration?: string;
  social_activity?: string;
  sleep_time?: string;
  total_score: number;
  category: string;
  schoolEmail: string;
}

export interface ApprovedSchool {
  id: string;
  email: string;
  addedAt: string;
}
