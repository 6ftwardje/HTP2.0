export type Student = {
  id: string;
  email: string;
  name: string | null;
  auth_user_id: string;
  access_level: number;
  mentor_status: "active" | "watch" | "needs_attention";
  tags: string[];
  onboarding_skipped_at: string | null;
  created_at: string;
  updated_at: string;
  last_seen: string | null;
  phone: string | null;
};

export type Module = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  order_index: number;
  thumbnail_url: string | null;
  icon_url: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type Lesson = {
  id: number;
  module_id: number;
  title: string;
  slug: string;
  description: string | null;
  takeaway: string | null;
  action_items: string[];
  video_url: string | null;
  video_provider: string;
  video_duration_seconds: number | null;
  thumbnail_url: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  mux_playback_policy: "public" | "signed";
  mux_status: "preparing" | "ready" | "errored" | null;
  mux_upload_id: string | null;
  mux_error_message: string | null;
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type WeeklyUpdateAccessTier =
  | "free"
  | "full_course"
  | "premium"
  | "mentor_membership";

export type WeeklyUpdate = {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  key_takeaways: string[];
  market: string | null;
  week_start_date: string;
  mentor_student_id: string | null;
  created_by_student_id: string | null;
  access_tier: WeeklyUpdateAccessTier;
  video_provider: "mux" | "vimeo" | "youtube";
  video_url: string | null;
  video_duration_seconds: number | null;
  thumbnail_url: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  mux_playback_policy: "public" | "signed";
  mux_status: "preparing" | "ready" | "errored" | null;
  mux_upload_id: string | null;
  mux_error_message: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DashboardStats = {
  totalModules: number;
  publishedModules: number;
  totalLessons: number;
};

export type Progress = {
  id: string;
  student_id: string;
  lesson_id: number;
  watched: boolean;
  watched_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WeeklyUpdateView = {
  id: string;
  student_id: string;
  weekly_update_id: number;
  watched: boolean;
  watched_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LessonActionProgress = {
  id: string;
  student_id: string;
  lesson_id: number;
  action_index: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Exam = {
  id: number;
  module_id: number;
  title: string;
  description: string | null;
  passing_score: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type ExamQuestion = {
  id: number;
  exam_id: number;
  module_id?: number;
  question: string;
  question_text?: string;
  explanation?: string | null;
  is_active?: boolean;
  options: string[];
  correct_answer: string;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type ExamAnswerOption = {
  id: number;
  question_id: number;
  option_text: string;
  is_correct: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type PublicExamOption = {
  id: number;
  optionText: string;
};

export type PublicExamQuestion = {
  id: number;
  questionText: string;
  explanation: string | null;
  options: PublicExamOption[];
};

export type PublicExamAttempt = {
  attemptId: string;
  examId: number;
  moduleId: number;
  status: "in_progress" | "submitted";
  score: number | null;
  passed: boolean | null;
  totalQuestions: number;
  questions: PublicExamQuestion[];
};

export type ExamResult = {
  id: string;
  student_id: string;
  exam_id: number;
  score: number;
  passed: boolean;
  submitted_at: string;
  created_at: string;
};

/** Lesson status for UI: locked, available, or completed */
export type LessonStatus = "locked" | "available" | "completed";

export type LessonWithStatus = Lesson & { status: LessonStatus };

export type StudentOnboardingResponse = {
  id: string;
  student_id: string;
  experience_level: string | null;
  primary_market: string | null;
  main_challenge: string | null;
  goal_90_days: string | null;
  weekly_time_commitment: string | null;
  mentorship_interest: string | null;
  confidence_score: number | null;
  tools: Record<string, boolean>;
  completed_at: string | null;
  intake_version: string;
  created_at: string;
  updated_at: string;
};

export type StudentNextStep = {
  id: string;
  student_id: string;
  step_key: string;
  step_type:
    | "intake"
    | "lesson"
    | "lesson_action"
    | "exam"
    | "module"
    | "mentor_action"
    | "live_session"
    | "physical_lesson"
    | "custom";
  status: "active" | "completed" | "dismissed";
  title: string;
  description: string | null;
  href: string | null;
  cta_label: string | null;
  source_table: string | null;
  source_id: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentMentorNote = {
  id: string;
  student_id: string;
  author_student_id: string | null;
  body: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

/** Gestructureerde output van Mentor Copilot (feature 'mentor_summary'). */
export type MentorSummary = {
  status: string;
  voortgang: string;
  risicos: string[];
  call_focus: string[];
  open_vragen: string[];
};

/** Gecachte AI-samenvatting per student per feature (tabel ai_student_summaries). */
export type AiStudentSummary = {
  id: string;
  student_id: string;
  feature: string;
  summary: MentorSummary;
  model: string | null;
  generated_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Append-only logregel van een AI-call (tabel ai_interactions). */
export type AiInteraction = {
  id: string;
  student_id: string | null;
  actor_student_id: string | null;
  feature: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  status: "success" | "error";
  error: string | null;
  created_at: string;
};

export type ConversationThreadStatus =
  | "open"
  | "pending_mentor"
  | "pending_student"
  | "snoozed"
  | "closed";

export type ConversationThreadPriority = "normal" | "high" | "urgent";

export type ConversationThread = {
  id: string;
  student_id: string;
  assigned_to_student_id: string | null;
  status: ConversationThreadStatus;
  priority: ConversationThreadPriority;
  category: string | null;
  source_type: string;
  source_id: string | null;
  subject: string | null;
  last_message_at: string | null;
  last_student_message_at: string | null;
  last_mentor_message_at: string | null;
  unread_for_student_count: number;
  unread_for_mentor_count: number;
  first_response_at: string | null;
  closed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ConversationMessageSenderRole =
  | "student"
  | "mentor"
  | "admin"
  | "ai"
  | "system";

export type ConversationMessage = {
  id: string;
  thread_id: string;
  sender_student_id: string | null;
  sender_role: ConversationMessageSenderRole;
  body: string;
  body_format: "plain" | "markdown";
  client_message_id: string | null;
  status: "sent" | "delivered" | "read" | "failed" | "deleted";
  is_internal: boolean;
  parent_message_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export type NotificationEvent = {
  id: string;
  type: string;
  actor_student_id: string | null;
  target_table: string | null;
  target_id: string | null;
  title: string;
  body: string | null;
  href: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type NotificationRecipient = {
  id: string;
  event_id: string;
  student_id: string;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
};

export type NotificationWithEvent = NotificationRecipient & {
  event: NotificationEvent | null;
};
