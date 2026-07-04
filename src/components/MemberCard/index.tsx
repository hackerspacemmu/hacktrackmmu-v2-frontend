import {
  CheckCircle,
  CircleAlert,
  FolderCode,
  Hammer,
  Lightbulb,
  PenLine,
  Speech,
  User,
  Edit,
  Trash,
  Clock,
  CalendarRange,
  History,
} from "lucide-react";
import { useState } from "react";
import { ModalLayout } from "../ModalLayout";
import useAuthStore from "@/store/useAuthStore";
import Link from "next/link";
import dayjs from "dayjs";
import { Member, Project, Update } from "@/types/types";
import { apiUrl } from "@/utils/env";
import axios from "axios";
import Head from "next/head";
import { useToast } from "@/components/Toast/ToastProvider";
import { EditProjectForm, EditProjectData } from "../Forms/EditProjectForm";
import { EditUpdateForm, EditUpdateData } from "../Forms/EditUpdateForm";
import { NullTextIndicator } from "@/components/atomComponents/NullTextIndicator";

interface MemberCardProps extends Member {
  mutateMembers?: () => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function MemberCard({
  id,
  name,
  projects,
  status,
  duration_active,
  avg_time_between_talks,
  meetups_since_last_talk,
  mutateMembers,
  other_info,
}: MemberCardProps) {
  const { token, isAdmin } = useAuthStore();
  const { showToast } = useToast();

  let ideaTalksCount = 0;
  let progressTalksCount = 0;
  const numberOfUpdates = projects.reduce(
    (acc, project) => acc + project.updates.length,
    0,
  );

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalView, setModalView] = useState<
    "list" | "edit-project" | "edit-update"
  >("list");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const [editingProjectId, setEditingProjectId] = useState<
    string | number | null
  >(null);
  const [editingUpdateId, setEditingUpdateId] = useState<
    string | number | null
  >(null);

  projects.forEach((project) => {
    project.updates?.forEach((update) => {
      const cat = String(update.category);
      if (cat === "idea_talk" || cat === "0") {
        ideaTalksCount++;
      } else {
        progressTalksCount++;
      }
    });
  });

  const handleCardClick = () => setIsModalOpen(true);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setModalView("list");
      setEditingProjectId(null);
      setEditingUpdateId(null);
    }, 300);
  };

  const formatStatus = (status: string | undefined) => {
    if (!status) return "";
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const handleEditProjectClick = (project: Project) => {
    setEditingProjectId(project.id);
    setModalView("edit-project");
  };

  const handleDeleteProject = async (projectId: string | number) => {
    if (
      confirm(
        "Are you sure you want to delete this project? This will also delete any associated updates!",
      )
    ) {
      setDeletingId(projectId);
      try {
        await axios.delete(`${apiUrl}/api/v1/projects/${projectId}`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        await sleep(500);
        if (mutateMembers) await mutateMembers();
        showToast("Project deleted successfully", "success");
      } catch {
        showToast("Unable to delete project.", "error");
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleSaveProject = async (data: EditProjectData) => {
    if (!editingProjectId) return;
    setIsSaving(true);
    try {
      await axios.patch(
        `${apiUrl}/api/v1/projects/${editingProjectId}`,
        {
          project: {
            name: data.name,
            completed: data.completed,
            category: data.category,
            member_ids: [data.memberId],
          },
        },
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      await sleep(500);
      if (mutateMembers) await mutateMembers();
      showToast("Project edited successfully!", "success");
      setModalView("list");
      setEditingProjectId(null);
    } catch {
      showToast("Unable to edit project. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditUpdateClick = (update: Update) => {
    setEditingUpdateId(update.id);
    setModalView("edit-update");
  };

  const handleDeleteUpdate = async (updateId: string | number) => {
    if (confirm("Are you sure you want to delete this update?")) {
      setDeletingId(`update-${updateId}`);
      try {
        await axios.delete(`${apiUrl}/api/v1/updates/${updateId}`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        await sleep(500);
        if (mutateMembers) await mutateMembers();
        showToast("Update deleted successfully", "success");
      } catch {
        showToast("Unable to delete update.", "error");
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleSaveUpdate = async (data: EditUpdateData) => {
    if (!editingUpdateId) return;
    setIsSaving(true);
    try {
      await axios.patch(
        `${apiUrl}/api/v1/updates/${editingUpdateId}`,
        {
          update: {
            meetup_id: data.meetupId,
            project_id: data.projectId,
            member_id: data.memberId,
            category: data.category,
            description: data.description,
          },
        },
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      await sleep(500);
      if (mutateMembers) await mutateMembers();
      showToast("Update edited successfully!", "success");
      setModalView("list");
      setEditingUpdateId(null);
    } catch {
      showToast("Unable to edit update.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const findEditingProject = projects.find((p) => p.id === editingProjectId);
  let findEditingUpdate: Update | undefined;
  if (modalView === "edit-update") {
    projects.forEach((p) => {
      const match = p.updates?.find((u) => u.id === editingUpdateId);
      if (match) findEditingUpdate = match;
    });
  }

  return (
    <>
      {isModalOpen && (
        <Head>
          <title key="title">
            {modalView === "edit-project"
              ? "HackTrack - Edit Project"
              : modalView === "edit-update"
                ? "HackTrack - Edit Update"
                : `HackTrack - ${name}'s profile`}
          </title>
        </Head>
      )}
      <div
        onClick={handleCardClick}
        className="bg-white dark:bg-[#222] rounded-lg p-4 border-2 dark:border border-neutral-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-200 hover:shadow-gray-600/50 hover:shadow-[0px_0px_8px_1px_rgba(0,_0,_0,_0.1)] dark:hover:shadow-gray-200/50 active:shadow-none transition duration-200 cursor-pointer"
      >
        <h1 className="text-lg flex justify-between">
          <div className="flex items-center">
            <User size="18" className="mr-2" />
            <span className="font-bold line-clamp-1">{name}</span>
          </div>
          <span className="text-gray-500 ml-2 text-[12px]">
            {formatStatus(status)}
          </span>
        </h1>
        <hr className="border-gray-600 mb-2" />
        <p className="flex items-center">
          <FolderCode size="16" className="mr-2" />
          {projects.length} Projects
        </p>
        <p className="flex items-center">
          <Speech size="16" className="mr-2" />
          ProgressTalks: {progressTalksCount}, IdeaTalks: {ideaTalksCount}
        </p>

        <p className="flex items-center">
          <Clock size="16" className="mr-2" />
          Active duration: {duration_active}
        </p>

        <p className="flex items-center">
          <CalendarRange size="16" className="mr-2" />
          Average between talks: {avg_time_between_talks}
        </p>

        <p className="flex items-center">
          <History size="16" className="mr-2" />
          {meetups_since_last_talk} meetup
          {meetups_since_last_talk > 1 || meetups_since_last_talk == 0
            ? "s"
            : ""}{" "}
          since last talk
        </p>
      </div>

      <ModalLayout isOpen={isModalOpen} onClose={handleCloseModal}>
        {modalView === "list" && (
          <>
            <div className="flex flex-row gap-2 items-center mb-4 justify-between">
              <h2 className="text-2xl font-bold">{name}</h2>
              {isAdmin && (
                <Link href={`/member/${id}/edit`}>
                  <PenLine
                    size={16}
                    className="hover:cursor-pointer hover:text-blue-500 transition duration-200"
                  />
                </Link>
              )}
            </div>

            <h3 className="text-lg font-semibold mb-1">Projects</h3>
            <div className="border border-gray-700 py-3 px-4 rounded-md mb-3 max-h-48 lg:max-h-64 overflow-y-auto flex flex-col gap-1">
              {projects && projects.length !== 0 ? (
                projects.map((project: Project) => (
                  <div
                    key={project.id}
                    className={`flex items-start justify-between group py-1.5 border-b border-gray-700 last:border-0 transition-opacity duration-200 ${
                      deletingId === project.id
                        ? "opacity-30 pointer-events-none"
                        : "opacity-100"
                    }`}
                  >
                    <div className="flex items-center gap-x-2 mr-2">
                      {project.completed ? (
                        <p className="text-green-500 flex items-center gap-x-2 font-medium">
                          {project.name}
                          <CheckCircle size="16" className="shrink-0" />
                        </p>
                      ) : (
                        <p>{project.name}</p>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="flex gap-x-3 shrink-0 ml-auto opacity-100 mt-0.5">
                        <button onClick={() => handleEditProjectClick(project)}>
                          <Edit
                            size="16"
                            className="text-blue-500 hover:text-blue-400"
                          />
                        </button>
                        <button onClick={() => handleDeleteProject(project.id)}>
                          <Trash
                            size="16"
                            className="text-red-500 hover:text-red-400"
                          />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-red-400 flex items-center gap-x-2">
                  <CircleAlert size="18" /> No projects made
                </p>
              )}
            </div>

            <h3 className="text-lg font-semibold mb-1">Talks</h3>
            <div className="overflow-y-auto border flex flex-col gap-y-3 px-4 py-3 mb-8 max-h-56 lg:max-h-80 rounded-md border-gray-700">
              {projects && projects.length !== 0 && numberOfUpdates > 0 ? (
                projects.map((project) =>
                  project.updates
                    ? project.updates.map((update: Update) => (
                        <div
                          key={update.id}
                          className={`border-b border-gray-700 pb-3 last:border-0 last:pb-0 transition-opacity duration-200 ${
                            deletingId === `update-${update.id}`
                              ? "opacity-30 pointer-events-none"
                              : "opacity-100"
                          }`}
                        >
                          <div className="flex justify-between items-start group">
                            <div className="font-bold flex items-center flex-1 min-w-0 mt-1">
                              <p className="font-semibold truncate">
                                {project.name}
                              </p>
                              {String(update.category) === "idea_talk" ||
                              String(update.category) === "0" ? (
                                <Lightbulb
                                  size="14"
                                  className="ml-2 shrink-0"
                                />
                              ) : (
                                <Hammer
                                  size="14"
                                  className="ml-2 shrink-0 text-blue-400"
                                />
                              )}
                            </div>

                            {isAdmin && (
                              <div className="flex gap-x-3 shrink-0 ml-4 opacity-100 mt-1">
                                <button
                                  onClick={() => handleEditUpdateClick(update)}
                                >
                                  <Edit
                                    size="16"
                                    className="text-blue-500 hover:text-blue-400"
                                  />
                                </button>
                                <button
                                  onClick={() => handleDeleteUpdate(update.id)}
                                >
                                  <Trash
                                    size="16"
                                    className="text-red-500 hover:text-red-400"
                                  />
                                </button>
                              </div>
                            )}
                          </div>

                          <p className="text-sm mt-1 break-words whitespace-pre-line">
                            {update.description}
                          </p>
                          <p className="text-[#777] mt-1 text-sm font-semibold">
                            {update.meetup
                              ? dayjs(update.meetup.date).format("MMM D, YYYY")
                              : "Unknown Date"}
                          </p>
                        </div>
                      ))
                    : null,
                )
              ) : (
                <p className="text-red-400 flex items-center gap-x-2">
                  <CircleAlert size="18" /> No updates made
                </p>
              )}
            </div>

            <h3 className="text-lg font-semibold mb-1 mt-4">Other Information</h3>
            <div className="border border-gray-700 py-3 px-4 rounded-md mb-4 max-h-48 overflow-y-auto flex flex-col gap-y-1.5 text-sm">
              <p>
                <span className="font-semibold text-black dark:text-white">Affiliation with MMU:</span>{" "}
                {other_info?.affiliation_with_mmu || <NullTextIndicator />}
              </p>
              <p>
                <span className="font-semibold text-black dark:text-white">Faculty:</span>{" "}
                {other_info?.faculty || <NullTextIndicator />}
              </p>
              <p>
                <span className="font-semibold text-black dark:text-white">Year Joined MMU:</span>{" "}
                {other_info?.year_joined || <NullTextIndicator />}
              </p>
              <p>
                <span className="font-semibold text-black dark:text-white">From Where:</span>{" "}
                {other_info?.from_where || <NullTextIndicator />}
              </p>
              <p>
                <span className="font-semibold text-black dark:text-white">Instagram Handle:</span>{" "}
                {other_info?.instagram_handle || <NullTextIndicator />}
              </p>
              <p>
                <span className="font-semibold text-black dark:text-white">Hacking Strengths:</span>{" "}
                {other_info?.hacking_strengths || <NullTextIndicator />}
              </p>
              <p>
                <span className="font-semibold text-black dark:text-white">Hacking Interests:</span>{" "}
                {other_info?.hacking_interests || <NullTextIndicator />}
              </p>
              <p>
                <span className="font-semibold text-black dark:text-white">Why Joined:</span>{" "}
                {other_info?.why_join || <NullTextIndicator />}
              </p>
              <p>
                <span className="font-semibold text-black dark:text-white">Project to be Worked On:</span>{" "}
                {other_info?.project_to_be_worked_on || <NullTextIndicator />}
              </p>
            </div>

            <button
              onClick={handleCloseModal}
              className="dark:bg-white hover:bg-white-600 dark:text-black bg-[#222] dark:hover:bg-[#e0e0e0] dark:active:bg-[#c7c7c7] text-white hover:bg-[#333] active:bg-[#444] font-bold py-2 px-4 rounded w-full transition duration-200"
            >
              Close
            </button>
          </>
        )}

        {modalView === "edit-project" && findEditingProject && (
          <EditProjectForm
            project={findEditingProject}
            defaultMemberId={id}
            isSaving={isSaving}
            onCancel={() => setModalView("list")}
            onSave={handleSaveProject}
          />
        )}

        {modalView === "edit-update" && findEditingUpdate && (
          <EditUpdateForm
            update={findEditingUpdate}
            isSaving={isSaving}
            meetupFetchUrl={`${apiUrl}/api/v1/meetups?category=regular_meetup`}
            onCancel={() => setModalView("list")}
            onSave={handleSaveUpdate}
          />
        )}
      </ModalLayout>
    </>
  );
}
