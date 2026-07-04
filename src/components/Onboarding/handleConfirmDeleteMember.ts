import axios from "axios";
import { apiUrl } from "@/utils/env";

interface HandleConfirmDeleteMemberParams {
  memberId: number;
  token: string;
  mutateOnboarding: () => void;
  showToast: (message: string, type: "success" | "error") => void;
  handleCloseDeleteModal: () => void;
  setIsDeleting: (isDeleting: boolean) => void;
  onDeleteMemberLocal?: (id: number) => void;
}

export const handleConfirmDeleteMember = async ({
  memberId,
  token,
  mutateOnboarding,
  showToast,
  handleCloseDeleteModal,
  setIsDeleting,
  onDeleteMemberLocal,
}: HandleConfirmDeleteMemberParams) => {
  setIsDeleting(true);
  try {
    await axios.delete(`${apiUrl}/api/v1/members/${memberId}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    mutateOnboarding();
    onDeleteMemberLocal?.(memberId);
    showToast("Member deleted successfully", "success");
    handleCloseDeleteModal();
  } catch (error) {
    console.error("Error deleting member", error);
    showToast("Failed to delete member", "error");
  } finally {
    setIsDeleting(false);
  }
};
