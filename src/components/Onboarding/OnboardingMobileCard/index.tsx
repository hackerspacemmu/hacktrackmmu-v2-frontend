import { Member, MemberStatus, MemberStatusLabels } from "@/types/types";
import dayjs from "dayjs";
import { OnboardingMemberModal } from "../OnboardingMemberModal";
import { useState } from "react";
import { apiUrl } from "@/utils/env";
import axios from "axios";
import useAuthStore from "@/store/useAuthStore";
import { useToast } from "@/components/Toast/ToastProvider";
import Link from "next/link";
import DeleteModal from "../DeleteModal";
import { handleConfirmDeleteMember } from "../handleConfirmDeleteMember";

interface OnboardingMobileCardProps {
  member: Member;
  mutateOnboarding: () => void;
  onUpdateMemberLocal?: (updatedMember: Member) => void;
  onDeleteMemberLocal?: (id: number) => void;
}

const ONBOARDING_STATUSES = [
  MemberStatus.Registered,
  MemberStatus.Contacted,
  MemberStatus.FirstTalkGiven,
  MemberStatus.NeverActive,
  MemberStatus.Active,
  MemberStatus.SociallyActive,
  MemberStatus.WasActive,
  MemberStatus.WasSociallyActive,
  MemberStatus.Terminated,
  MemberStatus.Duplicate,
];

export default function OnboardingMobileCard({
  member,
  mutateOnboarding,
  onUpdateMemberLocal,
  onDeleteMemberLocal,
}: OnboardingMobileCardProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleViewClick = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);
  const handleDeleteMember = () => setIsDeleteModalOpen(true);
  const handleCloseDeleteModal = () => setIsDeleteModalOpen(false);

  const handleStatusChange = async (newStatus: MemberStatus) => {
    if (newStatus === member.status) return;

    setIsUpdating(true);
    try {
      await axios.put(
        `${apiUrl}/api/v1/members/${member.id}`,
        { member: { status: newStatus } },
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      mutateOnboarding();
      onUpdateMemberLocal?.({ ...member, status: newStatus });
      showToast("Member status updated successfully", "success");
    } catch (error) {
      console.error("Error updating status", error);
      showToast("Failed to update status", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="border border-gray-700 bg-[#1e1e1e]/30 rounded-lg p-4 mb-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col overflow-hidden">
          <h2 className="text-lg font-bold mb-1 text-gray-100 truncate">
            {member.name}
          </h2>
          <p className="text-sm mb-1 text-gray-300 truncate">
            <span className="font-semibold text-gray-500">Contact: </span>
            {member.contact_number || "N/A"}
          </p>
          <p className="text-sm text-gray-300 truncate">
            <span className="font-semibold text-gray-500">Created: </span>
            {dayjs(member.created_at).format("MMM D, YYYY")}
          </p>
        </div>

        <div className="w-full">
          <select
            value={member.status}
            onChange={(e) => handleStatusChange(e.target.value as MemberStatus)}
            disabled={isUpdating}
            className="w-full px-3 py-2.5 text-sm font-medium border border-gray-600 rounded-md bg-transparent text-gray-200 cursor-pointer focus:outline-none focus:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ONBOARDING_STATUSES.map((status) => (
              <option
                key={status}
                value={status}
                className="bg-[#1e1e1e] text-white py-2"
              >
                {MemberStatusLabels[status].toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Bottom Action Buttons ── */}
      <div className="mt-5 border-t border-gray-800 pt-4">
        <div className="flex justify-between gap-2">
          <button
            className="flex-1 text-black text-sm font-semibold bg-[#d9d9d9] py-2 rounded-md transition duration-200 hover:bg-gray-200 active:bg-gray-400"
            onClick={handleViewClick}
          >
            View
          </button>

          <Link
            href={`/member/${member.id}/edit?source=onboarding`}
            passHref
            className="flex-1"
          >
            <button className="w-full text-white text-sm font-semibold bg-blue-800 py-2 rounded-md transition duration-200 hover:bg-blue-700 active:bg-blue-900">
              Edit
            </button>
          </Link>

          <button
            onClick={handleDeleteMember}
            className="flex-1 text-white text-sm font-semibold bg-red-800 py-2 rounded-md transition duration-200 hover:bg-red-700 active:bg-red-900"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Modals */}
      <OnboardingMemberModal
        isModalOpen={isModalOpen}
        handleCloseModal={handleCloseModal}
        member={member}
        mutateOnboarding={mutateOnboarding}
        onUpdateMemberLocal={onUpdateMemberLocal}
        onDeleteMemberLocal={onDeleteMemberLocal}
      />

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={() =>
          handleConfirmDeleteMember({
            memberId: member.id,
            token,
            mutateOnboarding,
            showToast,
            handleCloseDeleteModal,
            setIsDeleting,
            onDeleteMemberLocal,
          })
        }
        isDeleting={isDeleting}
      />
    </div>
  );
}
