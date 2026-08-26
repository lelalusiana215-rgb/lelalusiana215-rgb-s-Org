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
