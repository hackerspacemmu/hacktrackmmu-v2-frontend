import DashboardLayout from "@/components/DashboardLayout";
import useAuthStore from "@/store/useAuthStore";
import { apiUrl } from "@/utils/env";
import { fetcherWithToken } from "@/utils/fetcher";
import { Member, MemberStatus, getStatusLabel } from "@/types/types";
import { ChevronLeft, LoaderCircle } from "lucide-react";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useEffect, useState } from "react";

export default function EditMemberPage() {
  const { token } = useAuthStore();
  const router = useRouter();
  const { id } = router.query;

  const {
    data: member,
    error: memberError,
    isLoading: memberLoading,
  } = useSWR<Member>(
    token && id ? [`${apiUrl}/api/v1/members/${id}`, token] : null,
    ([url, token]: [string, string]) => fetcherWithToken(url, token),
  );

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    student_id: "",
    discord_tag: "",
    status: "" as MemberStatus | "",
    comment: "",
    contact_number: "",
    other_info: {
      affiliation_with_mmu: "",
      faculty: "",
      year_joined: "",
      from_where: "",
      hacking_strengths: "",
      hacking_interests: "",
      why_join: "",
      instagram_handle: "",
      project_to_be_worked_on: "",
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name || "",
        email: member.email || "",
        student_id: member.student_id || "",
        discord_tag: member.discord_tag || "",
        status: member.status || "",
        comment: member.comment || "",
        contact_number: member.contact_number || "",
        other_info: {
          affiliation_with_mmu: member.other_info?.affiliation_with_mmu || "",
          faculty: member.other_info?.faculty || "",
          year_joined: member.other_info?.year_joined || "",
          from_where: member.other_info?.from_where || "",
          hacking_strengths: member.other_info?.hacking_strengths || "",
          hacking_interests: member.other_info?.hacking_interests || "",
          why_join: member.other_info?.why_join || "",
          instagram_handle: member.other_info?.instagram_handle || "",
          project_to_be_worked_on: member.other_info?.project_to_be_worked_on || "",
        },
      });
    }
  }, [member]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOtherInfoChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      other_info: {
        ...prev.other_info,
        [name]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/v1/members/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ member: formData }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update member");
      }

      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (memberLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-[80vh]">
          <LoaderCircle className="animate-spin mr-2" size="80" />
        </div>
      </DashboardLayout>
    );
  }

  if (memberError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <h1 className="text-4xl font-bold">Error occurred</h1>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <button
        className="transition back-section mb-4 flex flex-row gap-2 rounded-2xl pl-2 pr-4 py-2 hover:text-blue-400 active:text-blue-500"
        onClick={() => router.back()}
      >
        <ChevronLeft />
        <span>Back</span>
      </button>
      <div className="flex justify-center">
        <div className="p-6 bg-white dark:bg-[#222] border-2 dark:border border-neutral-400 dark:border-gray-700 w-[500px] rounded-lg">
          <h1 className="text-3xl font-bold mb-4 mt-2">Edit Member</h1>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border-2 dark:border border-neutral-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#333]"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border-2 dark:border border-neutral-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#333]"
              />
            </div>

            <div>
              <label htmlFor="student_id" className="block text-sm font-medium mb-1">
                Student ID
              </label>
              <input
                type="text"
                id="student_id"
                name="student_id"
                value={formData.student_id}
                onChange={handleChange}
                placeholder="e.g. 1211101234"
                className="w-full px-3 py-2 border-2 dark:border border-neutral-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#333]"
              />
            </div>

            <div>
              <label
                htmlFor="discord_tag"
                className="block text-sm font-medium mb-1"
              >
                Discord Tag
              </label>
              <input
                type="text"
                id="discord_tag"
                name="discord_tag"
                value={formData.discord_tag}
                onChange={handleChange}
                className="w-full px-3 py-2 border-2 dark:border border-neutral-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#333]"
              />
            </div>

            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium mb-1"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border-2 dark:border border-neutral-300 dark:border-gray-600 rounded-md text-black dark:text-white bg-gray-50 dark:bg-[#333]"
              >
                <option value="">Select a status</option>
                {Object.values(MemberStatus).map((status) => (
                  <option key={status} value={status}>
                    {getStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            {/*contact number*/}
            <div>
              <label
                htmlFor="contact_number"
                className="block text-sm font-medium mb-1"
              >
                Contact Number
              </label>
              <input
                type="text"
                id="contact_number"
                name="contact_number"
                value={formData.contact_number || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 border-2 dark:border border-neutral-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#333]"
              />
            </div>

            <div>
              <label
                htmlFor="comment"
                className="block text-sm font-medium mb-1"
              >
                Comment
              </label>
              <textarea
                id="comment"
                name="comment"
                value={formData.comment}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border-2 dark:border border-neutral-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#333]"
              />
            </div>

            <div className="border-t border-neutral-300 dark:border-gray-700 pt-4 mt-6">
              <h3 className="text-lg font-bold mb-4">Other Information</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="affiliation_with_mmu" className="block text-sm font-medium mb-1">
                    Affiliation with MMU
                  </label>
                  <select
                    id="affiliation_with_mmu"
                    name="affiliation_with_mmu"
                    value={formData.other_info.affiliation_with_mmu}
                    onChange={handleOtherInfoChange}
                    className="w-full px-3 py-2 border-2 dark:border border-neutral-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#333] text-black dark:text-white"
                  >
                    <option value="" disabled>Select Affiliation</option>
                    <option value="Student">Student</option>
                    <option value="Staff">Staff</option>
                    <option value="Alumni">Alumni</option>
                    {formData.other_info.affiliation_with_mmu &&
                      !["Student", "Staff", "Alumni"].includes(formData.other_info.affiliation_with_mmu) && (
                        <option value={formData.other_info.affiliation_with_mmu}>
                          {formData.other_info.affiliation_with_mmu}
                        </option>
                      )}
                  </select>
                </div>

                <div>
                  <label htmlFor="faculty" className="block text-sm font-medium mb-1">
                    Faculty
                  </label>
                  <input
                    type="text"
                    id="faculty"
                    name="faculty"
                    value={formData.other_info.faculty}
                    onChange={handleOtherInfoChange}
                    placeholder="e.g. FCI, FOE, FOB"
                    className="w-full px-3 py-2 border-2 dark:border border-neutral-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#333]"
                  />
                </div>

                <div>
                  <label htmlFor="year_joined" className="block text-sm font-medium mb-1">
                    Year Joined MMU
                  </label>
                  <input
                    type="text"
                    id="year_joined"
                    name="year_joined"
                    value={formData.other_info.year_joined}
                    onChange={handleOtherInfoChange}
                    placeholder="e.g. 2023"
                    className="w-full px-3 py-2 border-2 dark:border border-neutral-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#333]"
                  />
                </div>

                <div>
                  <label htmlFor="instagram_handle" className="block text-sm font-medium mb-1">
                    Instagram Handle
                  </label>
                  <input
                    type="text"
                    id="instagram_handle"
                    name="instagram_handle"
                    value={formData.other_info.instagram_handle}
                    onChange={handleOtherInfoChange}
                    placeholder="e.g. username"
                    className="w-full px-3 py-2 border-2 dark:border border-neutral-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-[#333]"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="transition px-4 py-2 bg-blue-600 dark:text-gray-50 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="transition px-4 py-2 bg-red-400 dark:bg-gray-100 text-gray-100 dark:text-black rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
