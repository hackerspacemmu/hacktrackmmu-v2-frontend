import { useState } from "react";
import { OnboardingMemberModal } from "../OnboardingMemberModal";
import { Member, MemberStatus, MemberStatusLabels } from "@/types/types";
import dayjs from "dayjs";
import Link from "next/link";
import { apiUrl } from "@/utils/env";
import axios from "axios";
import useAuthStore from "@/store/useAuthStore";
import { useToast } from "@/components/Toast/ToastProvider";
import { NullTextIndicator } from "@/components/atomComponents/NullTextIndicator";
import DeleteModal from "../DeleteModal";
import { handleConfirmDeleteMember } from "../handleConfirmDeleteMember";
import { ModalLayout } from "@/components/ModalLayout";

const truncateComment = (comment: string): string => {
  const words = comment.trim().split(/\s+/);
  if (words.length <= 4) return comment;
  return words.slice(0, 4).join(" ") + "...";
};

interface OnboardingTableRowProps {
  member: Member;
  mutateOnboarding: () => void;
  onUpdateMemberLocal?: (updatedMember: Member) => void;
  onDeleteMemberLocal?: (id: number) => void;
}

const statusColour: Partial<Record<MemberStatus, string>> = {
  [MemberStatus.Registered]: "white",
  [MemberStatus.Contacted]: "blue-400",
  [MemberStatus.FirstTalkGiven]: "green-400",
  [MemberStatus.NeverActive]: "gray-400",
  [MemberStatus.Active]: "yellow-400",
  [MemberStatus.SociallyActive]: "orange-400",
  [MemberStatus.WasActive]: "purple-400",
  [MemberStatus.WasSociallyActive]: "indigo-400",
  [MemberStatus.Terminated]: "red-400",
  [MemberStatus.Duplicate]: "zinc-300",
};

// Easy to modify: just add/remove statuses here
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

export default function OnboardingTableRow({
  member,
  mutateOnboarding,
  onUpdateMemberLocal,
  onDeleteMemberLocal,
}: OnboardingTableRowProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [isSavingComment, setIsSavingComment] = useState(false);

  const handleViewClick = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);
  const handleDeleteMember = () => setIsDeleteModalOpen(true);
  const handleCloseDeleteModal = () => setIsDeleteModalOpen(false);

  const handleOpenCommentModal = () => {
    setCommentDraft(member.comment || "");
    setIsCommentModalOpen(true);
  };

  const handleSaveComment = async () => {
    setIsSavingComment(true);
    try {
      await axios.put(
        `${apiUrl}/api/v1/members/${member.id}`,
        { member: { comment: commentDraft } },
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      mutateOnboarding();
      onUpdateMemberLocal?.({ ...member, comment: commentDraft });
      showToast("Comment updated successfully", "success");
      setIsCommentModalOpen(false);
    } catch (error) {
      console.error("Error updating comment", error);
      showToast("Failed to update comment", "error");
    } finally {
      setIsSavingComment(false);
    }
  };

  const handleStatusChange = async (newStatus: MemberStatus) => {
    if (newStatus === member.status) return;

    setIsUpdating(true);
    try {
      await axios.put(
        `${apiUrl}/api/v1/members/${member.id}`,
        {
          member: {
            status: newStatus,
          },
        },
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
    <>
      <td className="pl-8 pr-2 py-4 min-w-[150px] overflow-auto">
        {member.name}
      </td>
      <td className="py-4 px-4">
        {member.contact_number || <NullTextIndicator />}
      </td>
      <td className="py-4 px-4">
        {member.register_date ? (
          dayjs(member.register_date).format("MMM D, YYYY")
        ) : (
          <NullTextIndicator />
        )}
      </td>

      <td className="py-4 px-4 max-w-[160px]">
        <button
          onClick={handleOpenCommentModal}
          title={member.comment || "No comment — click to add"}
          className="text-left text-gray-300 hover:text-white transition-colors truncate w-full"
        >
          {member.comment ? (
            truncateComment(member.comment)
          ) : (
            <span className="text-gray-600 italic text-xs">Add comment...</span>
          )}
        </button>
      </td>

      <td className="py-4 px-4">
        <select
          value={member.status}
          onChange={(e) => handleStatusChange(e.target.value as MemberStatus)}
          disabled={isUpdating}
          className={`px-2 py-1 text-xs font-medium border-gray-200 border ${
            statusColour[member.status as MemberStatus] || "text-blue-500"
          } rounded-full bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {ONBOARDING_STATUSES.map((status) => (
            <option
              key={status}
              value={status}
              className="bg-[#1e1e1e] text-white"
            >
              {MemberStatusLabels[status].toUpperCase()}
            </option>
          ))}
        </select>
      </td>
      <td className="text-left py-2 pl-2 pr-8 w-[280px] items-center ">
        <div className="button-container flex gap-x-2 gap-y-2 flex-wrap justify-center">
          <button
            onClick={handleViewClick}
            className="w-[75px] text-black text-sm font-semibold bg-[#d9d9d9] py-1.5 rounded-full transition duration-200 hover:bg-gray-200 active:bg-gray-400"
          >
            View
          </button>
          <Link href={`/member/${member.id}/edit?source=onboarding`} passHref>
            <button className="w-[75px] text-white text-sm font-semibold bg-blue-800 py-1.5 rounded-full transition duration-200 hover:bg-blue-700 active:bg-gray-400">
              Edit
            </button>
          </Link>
          <button
            onClick={handleDeleteMember}
            className="w-[75px] text-white text-sm font-semibold bg-red-800 py-1.5 rounded-full transition duration-200 hover:bg-red-700 active:bg-gray-400"
          >
            Delete
          </button>
        </div>
      </td>

      <OnboardingMemberModal
        isModalOpen={isModalOpen}
        handleCloseModal={handleCloseModal}
        member={member}
        mutateOnboarding={mutateOnboarding}
        onUpdateMemberLocal={onUpdateMemberLocal}
        onDeleteMemberLocal={onDeleteMemberLocal}
      />

      <ModalLayout isOpen={isCommentModalOpen} onClose={() => setIsCommentModalOpen(false)}>
        <h2 className="text-lg font-bold mb-1">{member.name}</h2>
        <p className="text-sm text-gray-400 mb-3">Edit Comment</p>
        <textarea
          value={commentDraft}
          onChange={(e) => setCommentDraft(e.target.value)}
          rows={5}
          className="w-full bg-[#1a1a1a] border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 resize-none focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="Write a comment..."
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleSaveComment}
            disabled={isSavingComment}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-md transition-colors"
          >
            {isSavingComment ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => setIsCommentModalOpen(false)}
            disabled={isSavingComment}
            className="flex-1 py-2 border border-gray-600 hover:bg-gray-800 text-gray-200 text-sm font-semibold rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      </ModalLayout>

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
    </>
  );
}
