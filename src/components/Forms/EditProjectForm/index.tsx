import { useEffect, useState } from "react";
import useSWR from "swr";
import useAuthStore from "@/store/useAuthStore";
import { fetcherWithToken } from "@/utils/fetcher";
import { apiUrl } from "@/utils/env";
import { Project, ProjectMember, Member } from "@/types/types";
import { MultiSelectDropdown } from "@/components/atomComponents/Dropdown/MultiSelectDropdown";

export interface EditProjectData {
  name: string;
  completed: boolean;
  category: string;
  memberIds: string[];
}

interface EditProjectFormProps {
  project: Project;
  defaultMemberId: string | number; // Fallback if project has no members
  isSaving: boolean;
  onCancel: () => void;
  onSave: (data: EditProjectData) => void;
}

export function EditProjectForm({
  project,
  defaultMemberId,
  isSaving,
  onCancel,
  onSave,
}: EditProjectFormProps) {
  const { token } = useAuthStore();

  const [name, setName] = useState(project.name);
  const [completed, setCompleted] = useState(project.completed);

  const rawCategory = String(project.category);
  const initialCategory =
    rawCategory === "1" || rawCategory === "mini_project"
      ? "mini_project"
      : rawCategory === "2" || rawCategory === "group_project"
        ? "group_project"
        : "project";

  const [category, setCategory] = useState<string>(initialCategory);
  const [memberIds, setMemberIds] = useState<string[]>([String(defaultMemberId)]);

  // The member list the card was rendered from doesn't carry the project's
  // roster, so load it and pre-fill with it - otherwise saving from one
  // member's card would drop everyone else on a group project.
  const { data: projectData } = useSWR(
    token ? [`${apiUrl}/api/v1/projects/${project.id}`, token] : null,
    ([url, token]: [string, string]) => fetcherWithToken(url, token),
  );
  const projectMembers: ProjectMember[] = projectData?.members ?? [];

  useEffect(() => {
    if (projectMembers.length > 0) {
      setMemberIds(projectMembers.map((m) => String(m.id)));
    }
  }, [projectData]); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    data: membersData,
    error: membersError,
    isLoading: membersLoading,
  } = useSWR(
    token ? [`${apiUrl}/api/v1/members?unpaginated=true`, token] : null,
    ([url, token]: [string, string]) => fetcherWithToken(url, token),
  );
  const membersList = membersData?.data || membersData || [];

  const handleSave = () => {
    onSave({ name, completed, category, memberIds });
  };

  const fetchedOptions: { id: string; name: string }[] = membersList.map(
    (m: Member) => ({
      id: String(m.id),
      name: m.name,
    }),
  );

  // Keep the project's current members visible as tags even before the member
  // list finishes loading, or if one of them is missing from it.
  const fetchedIds = new Set(fetchedOptions.map((o) => o.id));
  const memberOptions = [
    ...fetchedOptions,
    ...projectMembers
      .filter((m) => !fetchedIds.has(String(m.id)))
      .map((m) => ({ id: String(m.id), name: m.name })),
  ];

  return (
    <>
      <h2 className="text-2xl font-bold mb-6">Edit Project</h2>
      <div className="flex flex-col gap-5 mb-8">
        <div className="grid grid-cols-[100px_1fr] items-center">
          <label className="font-semibold text-sm">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-transparent text-sm w-full"
            placeholder="Enter project name..."
          />
        </div>

        <div className="grid grid-cols-[100px_1fr] items-center">
          <label className="font-semibold text-sm">Type</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`project-category-${project.id}`}
                value="project"
                checked={category === "project"}
                onChange={(e) => setCategory(e.target.value)}
                className="cursor-pointer accent-blue-500"
              />
              <span className="text-sm">Solo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`project-category-${project.id}`}
                value="mini_project"
                checked={category === "mini_project"}
                onChange={(e) => setCategory(e.target.value)}
                className="cursor-pointer accent-blue-500"
              />
              <span className="text-sm">Mini</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`project-category-${project.id}`}
                value="group_project"
                checked={category === "group_project"}
                onChange={(e) => setCategory(e.target.value)}
                className="cursor-pointer accent-blue-500"
              />
              <span className="text-sm">Group</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-[100px_1fr] items-start">
          <label className="font-semibold text-sm pt-4">Members</label>
          <div className="w-full">
            <MultiSelectDropdown
              id={`project-members-${project.id}`}
              name="members"
              label=""
              placeholder={
                membersLoading
                  ? "Loading members..."
                  : membersError
                    ? "Failed to load members"
                    : "Search and select..."
              }
              options={memberOptions}
              selectedValues={memberIds}
              onChange={setMemberIds}
            />
          </div>
        </div>

        <div className="grid grid-cols-[100px_1fr] items-center mt-2">
          <label className="font-semibold text-sm">Status</label>
          <label className="flex items-center gap-2 cursor-pointer w-max">
            <input
              type="checkbox"
              checked={completed}
              onChange={(e) => setCompleted(e.target.checked)}
              className="cursor-pointer w-4 h-4 accent-blue-500"
            />
            <span className="text-sm select-none">Mark as Completed</span>
          </label>
        </div>
      </div>

      <div className="flex gap-3 mt-auto">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 border border-gray-400 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-[#333] font-bold py-2 px-4 rounded transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || name.trim() === "" || memberIds.length === 0}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-200 disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </>
  );
}
