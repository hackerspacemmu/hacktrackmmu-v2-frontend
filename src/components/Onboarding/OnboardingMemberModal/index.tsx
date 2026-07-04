import { NullTextIndicator } from "@/components/atomComponents/NullTextIndicator";
import { ModalLayout } from "@/components/ModalLayout";
import { useToast } from "@/components/Toast/ToastProvider";
import useAuthStore from "@/store/useAuthStore";
import { Member, MemberStatus, MemberStatusLabels } from "@/types/types";
import { apiUrl } from "@/utils/env";
import axios from "axios";
import dayjs from "dayjs";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Edit,
  Mail,
  Phone,
  Tag,
  Trash,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { handleConfirmDeleteMember } from "../handleConfirmDeleteMember";
import DeleteModal from "../DeleteModal";

interface OnboardingMemberModalProps {
  isModalOpen: boolean;
  handleCloseModal: () => void;
  member: Member;
  mutateOnboarding: () => void;
  onUpdateMemberLocal?: (updatedMember: Member) => void;
  onDeleteMemberLocal?: (id: number) => void;
}

const convertToWhatsapp = (phoneNumber: string) => {
  const cleanedNumber = phoneNumber.replace(/\D/g, "");
  const countryCode = "60";

  if (cleanedNumber.startsWith(countryCode)) {
    return `https://wa.me/${cleanedNumber}`;
  } else {
    return `https://wa.me/${countryCode}${cleanedNumber}`;
  }
};

const STATUS_ORDER = [
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

const getStatusIndex = (status: MemberStatus): number => {
  return STATUS_ORDER.indexOf(status);
};

const getStatusByIndex = (index: number): MemberStatus | undefined => {
  return STATUS_ORDER[index];
};

export function OnboardingMemberModal({
  isModalOpen,
  handleCloseModal,
  member,
  mutateOnboarding,
  onUpdateMemberLocal,
  onDeleteMemberLocal,
}: OnboardingMemberModalProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { showToast } = useToast();
  const { token } = useAuthStore();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const currentStatusIndex = getStatusIndex(member.status as MemberStatus);
  const maxOnboardingIndex = getStatusIndex(MemberStatus.FirstTalkGiven);
  const minOnboardingIndex = getStatusIndex(MemberStatus.Registered);

  const canPromote =
    currentStatusIndex < maxOnboardingIndex &&
    currentStatusIndex >= minOnboardingIndex;
  const canDemote =
    currentStatusIndex > minOnboardingIndex &&
    currentStatusIndex <= maxOnboardingIndex;
  const isAtFinalOnboardingStatus = currentStatusIndex === maxOnboardingIndex;

  const getNextStatusLabel = () => {
    const nextStatus = getStatusByIndex(currentStatusIndex + 1);
    return nextStatus ? MemberStatusLabels[nextStatus] : "";
  };

  const getPreviousStatusLabel = () => {
    const prevStatus = getStatusByIndex(currentStatusIndex - 1);
    return prevStatus ? MemberStatusLabels[prevStatus] : "";
  };

  const updateStatus = async (change: "up" | "down") => {
    const newIndex =
      change === "up" ? currentStatusIndex + 1 : currentStatusIndex - 1;
    const newStatus = getStatusByIndex(newIndex);

    if (!newStatus) return;

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
      console.error("Error occurred during fetch", error);
      showToast("Failed to update status", "error");
    }
  };

  const copyToClipBoard = async (text: string, toastText: string = "Item") => {
    if (!text) {
      showToast(`No ${toastText} Available`, "error");
      return;
    }

    await navigator.clipboard.writeText(text);
    showToast(`${toastText} copied to Clipboard!`, "success");
  };

  const handleWhatsapp = (phoneNumber: string) => {
    if (!phoneNumber) {
      showToast("No Contact Number Available", "error");
      return;
    }
    const whatsappLink = convertToWhatsapp(phoneNumber);
    window.open(whatsappLink, "_blank");
  };

  const handleDeleteMember = () => setIsDeleteModalOpen(true);
  const handleCloseDeleteModal = () => setIsDeleteModalOpen(false);

  return (
    <>
      <ModalLayout isOpen={isModalOpen} onClose={handleCloseModal}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">{member.name}</h2>
          <div className="flex gap-x-2">
            <Link
              href={`/member/${member.id}/edit?source=onboarding`}
              passHref
              className="border p-[5px] border-blue-600 bg-blue-600 rounded-md"
            >
              <Edit size="16" className="text-white" />
            </Link>
            <button
              onClick={handleDeleteMember}
              className="border p-[5px] border-red-600 bg-red-600 rounded-md cursor-pointer"
            >
              <Trash size="16" className="text-white" />
            </button>
          </div>
        </div>

        <div className="status-container flex flex-row justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">
            Status:{" "}
            {MemberStatusLabels[member.status as MemberStatus] || member.status}
          </h3>
          {isClient && (
            <div className="arrow-containers flex flex-row gap-x-2 items-center">
              {isAtFinalOnboardingStatus && (
                <Link
                  href={`/member/${member.id}/edit?source=onboarding`}
                  passHref
                >
                  <button
                    className="bg-green-600 p-1 rounded-md"
                    title="Assign Status in Edit Page"
                  >
                    <Check size="16" className="text-white" />
                  </button>
                </Link>
              )}
              {canPromote ? (
                <button
                  title={`Promote to ${getNextStatusLabel()}`}
                  className="bg-blue-600 p-1 rounded-md transition hover:bg-blue-700"
                  onClick={() => updateStatus("up")}
                >
                  <ArrowUp size="16" className="text-white" />
                </button>
              ) : (
                <div className="bg-gray-600 p-1 rounded-md">
                  <ArrowUp size="16" className="text-white" />
                </div>
              )}
              {canDemote ? (
                <button
                  title={`Demote to ${getPreviousStatusLabel()}`}
                  className="bg-yellow-500 p-1 rounded-md transition hover:bg-yellow-600"
                  onClick={() => updateStatus("down")}
                >
                  <ArrowDown size="16" className="text-white" />
                </button>
              ) : (
                <div className="bg-gray-600 p-1 rounded-md">
                  <ArrowDown size="16" className="text-white" />
                </div>
              )}
            </div>
          )}
        </div>

        {isAtFinalOnboardingStatus && (
          <div className="bg-green-500 text-black font-bold text-sm p-2 rounded-md mt-2">
            <p>Select Tick Icon to Assign Status in Edit Page.</p>
          </div>
        )}

        <h3 className="text-lg font-semibold mt-4 mb-1">Contact Information</h3>
        <div className="flex flex-col gap-y-2">
          <div className="flex items-center justify-between border border-gray-700 py-3 px-4 rounded-md gap-3">
            <p className="min-w-0 truncate">
              <span className="font-bold">Email:</span> {member.email || "N/A"}
            </p>
            <div className="flex flex-row gap-x-4">
              <Copy
                onClick={() => copyToClipBoard(member.email, "Email")}
                className="hover:text-gray-400 hover:cursor-pointer active:text-green-500"
                size="16"
              />
              <Link href={`mailto:${member.email}`} passHref>
                <Mail
                  className="hover:text-gray-400 active:text-blue-500"
                  size="16"
                />
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-between border border-gray-700 py-3 px-4 rounded-md gap-3">
            <p className="min-w-0 truncate">
              <span className="font-bold">Contact Number:</span>{" "}
              {member.contact_number || <NullTextIndicator />}
            </p>
            <div className="flex flex-row gap-x-4">
              <Copy
                onClick={() =>
                  copyToClipBoard(member.contact_number, "Contact Number")
                }
                className="hover:text-gray-400 hover:cursor-pointer active:text-green-500"
                size="16"
              />
              <Phone
                onClick={() => handleWhatsapp(member.contact_number)}
                className="hover:text-gray-400 hover:cursor-pointer active:text-green-500"
                size={16}
              />
            </div>
          </div>
          <div className="flex items-center justify-between border border-gray-700 py-3 px-4 rounded-md gap-3">
            <p className="min-w-0 truncate">
              <span className="font-bold">Discord Tag:</span>{" "}
              {member.discord_tag || <NullTextIndicator />}
            </p>
            <div className="flex flex-row gap-x-4">
              <Copy
                onClick={() =>
                  copyToClipBoard(member.discord_tag, "Discord Tag")
                }
                className="hover:text-gray-400 hover:cursor-pointer active:text-green-500"
                size="16"
              />
              <Tag size={16} />
            </div>
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-1 mt-4">Comment</h3>
        <div className="flex flex-col gap-x-2 border border-gray-700 py-3 px-4 rounded-md max-h-36 lg:max-h-48 overflow-y-auto">
          <p>{member.comment || <NullTextIndicator />}</p>
        </div>

        <h3 className="text-lg font-semibold mb-1 mt-4">Other Information</h3>
        <div className="flex flex-col gap-y-1.5 border border-gray-700 py-3 px-4 rounded-md max-h-48 overflow-y-auto text-sm">
          <p>
            <span className="font-semibold">Register Date:</span>{" "}
            {dayjs(member.created_at).format("DD/MM/YYYY")}
          </p>
          <p>
            <span className="font-semibold">Register Time:</span>{" "}
            {dayjs(member.created_at).format("HH:mm")}
          </p>
          <p>
            <span className="font-semibold text-black dark:text-white">Affiliation with MMU:</span>{" "}
            {member.other_info?.affiliation_with_mmu || <NullTextIndicator />}
          </p>
          <p>
            <span className="font-semibold text-black dark:text-white">Faculty:</span>{" "}
            {member.other_info?.faculty || <NullTextIndicator />}
          </p>
          <p>
            <span className="font-semibold text-black dark:text-white">Year Joined MMU:</span>{" "}
            {member.other_info?.year_joined || <NullTextIndicator />}
          </p>
          <p>
            <span className="font-semibold text-black dark:text-white">From Where:</span>{" "}
            {member.other_info?.from_where || <NullTextIndicator />}
          </p>
          <p>
            <span className="font-semibold text-black dark:text-white">Instagram Handle:</span>{" "}
            {member.other_info?.instagram_handle || <NullTextIndicator />}
          </p>
          <p>
            <span className="font-semibold text-black dark:text-white">Hacking Strengths:</span>{" "}
            {member.other_info?.hacking_strengths || <NullTextIndicator />}
          </p>
          <p>
            <span className="font-semibold text-black dark:text-white">Hacking Interests:</span>{" "}
            {member.other_info?.hacking_interests || <NullTextIndicator />}
          </p>
          <p>
            <span className="font-semibold text-black dark:text-white">Why Joined:</span>{" "}
            {member.other_info?.why_join || <NullTextIndicator />}
          </p>
          <p>
            <span className="font-semibold text-black dark:text-white">Project to be Worked On:</span>{" "}
            {member.other_info?.project_to_be_worked_on || <NullTextIndicator />}
          </p>
        </div>

        <button
          onClick={handleCloseModal}
          className="dark:bg-white mt-5 hover:bg-white-600 dark:text-black bg-[#222] dark:hover:bg-[#e0e0e0] dark:active:bg-[#c7c7c7] text-white hover:bg-[#333] active:bg-[#444] font-bold py-2 px-4 rounded w-full transition duration-200"
        >
          Close
        </button>
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
