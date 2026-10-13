export type StudentStatus =
  'PENDING_VERIFICATION' | 'VERIFIED_AWAITING_CODE' | 'ACTIVE' | 'DISABLED';
export type StudentRecord = {
  id: string;
  email: string;
  status: StudentStatus;
  verifiedAt: number | null;
  deliveryState: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
};
export type StudentList = {
  items: StudentRecord[];
  total: number;
  page: number;
  pages: number;
  emailConfigured: boolean;
};
