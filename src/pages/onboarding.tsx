import DashboardLayout from "@/components/DashboardLayout";
import MemberFilter from "@/components/FilterPopover/memberFilter";
import OnboardingMobileCard from "@/components/Onboarding/OnboardingMobileCard";
import OnboardingTableRow from "@/components/Onboarding/OnboardingTableRow";
import SearchComponent from "@/components/Search";
import { useMediaQuery } from "@/hooks";
import useAuthStore from "@/store/useAuthStore";
import { MemberStatus, Member, getStatusLabel } from "@/types/types";

const MemberStatusComponent = ({ status }: { status: string }) => (
  <div className="border-neutral-400 border dark:border-gray-200 px-4 py-1 rounded-2xl text-center items-center flex">
    <p>{status}</p>
  </div>
);
import { apiUrl } from "@/utils/env";
import { fetcherWithToken } from "@/utils/fetcher";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";

const ALL_STATUSES = Object.values(MemberStatus);
const ONBOARDING_STATUSES = [
  MemberStatus.Registered,
  MemberStatus.Contacted,
  MemberStatus.FirstTalkGiven,
];

const ONBOARDING_SORT_OPTIONS = [
  { value: "newest", label: "Latest Registered" },
  { value: "oldest", label: "Earliest Registered" },
  { value: "recent_talks", label: "Recent Talks" },
  { value: "alphabetical", label: "Alphabetical" },
];

const DEFAULT_SORT = "newest";

export default function Onboarding() {
  const { token } = useAuthStore();
  const [isClient, setIsClient] = useState(false);
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const handleUpdateMemberLocal = (updatedMember: Member) => {
    setSearchResults((prev) =>
      prev.map((m) => (m.id === updatedMember.id ? updatedMember : m))
    );
  };

  const handleDeleteMemberLocal = (memberId: number) => {
    setSearchResults((prev) => prev.filter((m) => m.id !== memberId));
  };

  const isMaxWidth768px = useMediaQuery("(max-width: 768px)");
  const [paginationNumber, setPaginationNumber] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string[]>(ONBOARDING_STATUSES);
  const [sortBy, setSortBy] = useState<string>(DEFAULT_SORT);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const getSWRKey = () => {
    if (!token || !isClient || isSearching) return null;

    const queryParams = new URLSearchParams({
      page: paginationNumber.toString(),
      sort_by: sortBy,
    });
    statusFilter.forEach((status) => {
      queryParams.append("status[]", status);
    });

    return [`${apiUrl}/api/v1/members/filtered?${queryParams.toString()}`, token];
  };

  const {
    data: onboardingData,
    error: onboardingError,
    isLoading: onboardingLoading,
    mutate: mutateOnboarding,
  } = useSWR(getSWRKey(), ([url, token]) => fetcherWithToken(url, token));

  const totalPagination = onboardingData?.meta?.total_pages || 1;

  const members = isSearching
    ? searchResults.filter((m: Member) => statusFilter.includes(m.status))
    : onboardingData?.data || [];

  useEffect(() => {
    setPaginationNumber(1);
  }, [statusFilter, sortBy]);

  const handleStatusChange = (newStatuses: string[]) => {
    setStatusFilter(newStatuses);
  };

  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy);
  };

  const handleSearchResults = (results: Member[], searching: boolean) => {
    setSearchResults(results);
    setIsSearching(searching);
  };

  const handleSearchError = (error: unknown) => {
    console.error("Search failed:", error);
  };

  const currentStatusLabels = statusFilter.map((status) => getStatusLabel(status));

  const getCurrentSingleStatus = () => {
    if (statusFilter.length === 1) return statusFilter[0];
    return "all";
  };

  if (!isClient) {
    return (
      <DashboardLayout>
        <h1 className="text-4xl font-bold mt-6">Onboarding</h1>
        <p>Loading...</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout pageTitle="HackTrack - Onboarding">
      <div className="flex justify-between items-center mt-6 mb-3">
        <div className="flex flex-row gap-4">
          <h1 className="text-4xl font-bold">Onboarding</h1>
          <div className="currentStatusMap gap-2 flex-row items-center md:flex hidden">
            {statusFilter.length === ALL_STATUSES.length ? (
              <MemberStatusComponent status="All" />
            ) : (
              currentStatusLabels.map((status, index) => (
                <MemberStatusComponent key={index} status={status} />
              ))
            )}
          </div>
        </div>
        <MemberFilter
          onStatusChange={handleStatusChange}
          onSortChange={handleSortChange}
          currentStatus={getCurrentSingleStatus()}
          currentSortBy={sortBy}
          availableStatuses={ALL_STATUSES}
          defaultStatuses={ONBOARDING_STATUSES}
          availableSortOptions={ONBOARDING_SORT_OPTIONS}
          defaultSort={DEFAULT_SORT}
        />
      </div>

      {onboardingError && <p>Error loading data</p>}

      <div className="filter-section flex flex-row items-center justify-between my-3">
        <SearchComponent
          token={token}
          onSearchResults={handleSearchResults}
          onSearchError={handleSearchError}
        />
      </div>

      <div className="mt-4 border w-full border-gray-800 rounded-lg active:shadow-none transition duration-200">
        {!isMaxWidth768px ? (
          <table className="w-full text-sm text-left">
            <thead className="text-gray-200 bg-[#1e1e1e]">
              <tr className="border-b border-gray-800">
                <th className="pl-8 pr-2 py-4 bg-neutral-700 dark:bg-[#1e1e1e] min-w-[150px]">
                  Name
                </th>
                <th className="py-4 px-4 bg-neutral-700 dark:bg-[#1e1e1e]">
                  Contact Number
                </th>
                <th className="py-4 px-4 bg-neutral-700 dark:bg-[#1e1e1e]">
                  Register Date
                </th>
                <th className="py-4 px-4 bg-neutral-700 dark:bg-[#1e1e1e]">
                  Comment
                </th>
                <th className="py-4 px-4 bg-neutral-700 dark:bg-[#1e1e1e]">
                  Status
                </th>
                <th className="pl-2 pr-8 py-4 bg-neutral-700 dark:bg-[#1e1e1e] w-[297px]">
                  Options
                </th>
              </tr>
            </thead>
            <tbody>
              {members.length > 0 ? (
                members.map((member: Member) => (
                  <tr
                    key={member.id}
                    className="border-b border-gray-800 last:border-b-0"
                  >
                    <OnboardingTableRow
                      member={member}
                      mutateOnboarding={mutateOnboarding}
                      onUpdateMemberLocal={handleUpdateMemberLocal}
                      onDeleteMemberLocal={handleDeleteMemberLocal}
                    />
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    {onboardingLoading ? "Loading..." : "No members found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <>
            {members.length > 0 ? (
              members.map((member: Member) => (
                <OnboardingMobileCard
                  key={member.id}
                  member={member}
                  mutateOnboarding={mutateOnboarding}
                  onUpdateMemberLocal={handleUpdateMemberLocal}
                  onDeleteMemberLocal={handleDeleteMemberLocal}
                />
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                {onboardingLoading ? "Loading..." : "No members found"}
              </div>
            )}
          </>
        )}
      </div>

      {!isSearching && (
        <div className="fixed flex items-center border-2 border-gray-200 dark:border-gray-700 rounded-full w-fit bottom-4 right-4 z-50 overflow-hidden">
          <button
            onClick={() => setPaginationNumber((prev) => Math.max(1, prev - 1))}
            className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 py-2 px-2 transition duration-200 hover:bg-gray-200 dark:hover:bg-neutral-800 active:bg-gray-300 dark:active:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={onboardingLoading || paginationNumber === 1}
          >
            <ChevronLeft />
          </button>
          <div className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 w-[75px] py-2 px-2 text-center border-x border-gray-200 dark:border-gray-700">
            {paginationNumber} - {totalPagination}
          </div>
          <button
            onClick={() =>
              setPaginationNumber((prev) => Math.min(totalPagination, prev + 1))
            }
            className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 py-2 px-2 transition duration-200 hover:bg-gray-200 dark:hover:bg-neutral-800 active:bg-gray-300 dark:active:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={onboardingLoading || paginationNumber >= totalPagination}
          >
            <ChevronRight />
          </button>
        </div>
      )}
    </DashboardLayout>
  );
}
