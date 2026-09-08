import ControlPanel from "@/components/Admin/ControlPanel";
import DashboardLayout from "@/components/DashboardLayout";
import HackathonCard from "@/components/HackathonCard";
import MeetupCard from "@/components/MeetupCard";
import MemberCard from "@/components/MemberCard";
import SkeletonActionButton from "@/components/SkeletonActionButton";
import SkeletonHackathonCard from "@/components/skeletonComponents/SkeletonHackathonCard";
import SkeletonMemberCard from "@/components/skeletonComponents/SkeletonMemberCard";
import SkeletonMeetupCard from "@/components/skeletonComponents/SkeletonMeetupCard";
import useAuthStore from "@/store/useAuthStore";
import { apiUrl } from "@/utils/env";
import { fetcherWithToken } from "@/utils/fetcher";
import { CircleArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";

export default function Home() {
  const [isClient, setIsClient] = useState(false);

  // Use the auth store directly instead of copying to local state
  const { token, isAdmin } = useAuthStore();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    data: members,
    error: membersError,
    isLoading: membersLoading,
    mutate: mutateMembers,
  } = useSWR(
    isClient && token ? [`${apiUrl}/api/v1/dashboard/members`, token] : null,
    ([url, token]) => fetcherWithToken(url, token),
  );

  const {
    data: meetups,
    error: meetupsError,
    isLoading: meetupsLoading,
    mutate: mutateMeetups,
  } = useSWR(
    isClient && token ? [`${apiUrl}/api/v1/dashboard/meetups`, token] : null,
    ([url, token]) => fetcherWithToken(url, token),
  );

  const {
    data: hackathons,
    error: hackathonsError,
    isLoading: hackathonsLoading,
    mutate: mutateHackathons,
  } = useSWR(
    isClient && token ? [`${apiUrl}/api/v1/dashboard/hackathons`, token] : null,
    ([url, token]) => fetcherWithToken(url, token),
  );

  if (!isClient) return null;

  if (meetupsLoading) {
    return (
      <DashboardLayout pageTitle="HackTrack - Home">
        <h1 className="text-4xl font-bold mt-6">Dashboard</h1>
        {isAdmin && (
          <div className="mt-10">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-semibold">Control Panel</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              <SkeletonActionButton />
              <SkeletonActionButton />
              <SkeletonActionButton />
            </div>
          </div>
        )}
        <div className="mt-10">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-semibold">Meetups</h2>
            <Link
              href="/meetups"
              className="flex items-center gap-x-2 dark:bg-white dark:hover:bg-[#e0e0e0] dark:text-black transition duration-200 bg-gray-800 hover:bg-gray-950 py-2 px-6 rounded-full font-semibold text-white"
            >
              <CircleArrowRight size="18" />
              View All
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
            {[...Array(4)].map((_, index) => (
              <SkeletonMeetupCard key={index} />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (meetupsError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <h1 className="text-4xl font-bold text-red-500">Error loading dashboard meetups.</h1>
      </div>
    );
  }

  return (
    <DashboardLayout pageTitle="HackTrack - Home">
      <h1 className="text-4xl font-bold mt-6">Dashboard</h1>
      {isAdmin && (
        <ControlPanel
          mutateMeetups={mutateMeetups}
          mutateHackathons={mutateHackathons}
          mutateMembers={mutateMembers}
        />
      )}

      {/* Meetups */}
      <div className="mt-10">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-semibold">Meetups</h2>
          <Link
            href="/meetups"
            className="flex items-center gap-x-2 dark:bg-white dark:hover:bg-[#e0e0e0] dark:text-black transition duration-200 bg-gray-800 hover:bg-gray-950 py-2 px-6 rounded-full font-semibold text-white"
          >
            <CircleArrowRight size="18" />
            View All
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
          {Array.isArray(meetups) &&
            meetups.map((meetup: any) => (
              <MeetupCard
                key={meetup.id}
                id={meetup.id}
                number={meetup.number}
                date={meetup.date}
                numberOfUpdates={meetup.updates.length}
                hostName={meetup.host?.name || "unknown host"}
                updates={meetup.updates}
                mutateMeetups={mutateMeetups}
              />
            ))}
        </div>
      </div>

      {/* Hackathons */}
      <div className="mt-10">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-semibold">Hackathons</h2>
          <Link
            href="/meetups"
            className="flex items-center gap-x-2 dark:bg-white dark:hover:bg-[#e0e0e0] dark:text-black transition duration-200 bg-gray-800 hover:bg-gray-950 py-2 px-6 rounded-full font-semibold text-white"
          >
            <CircleArrowRight size="18" />
            View All
          </Link>
        </div>
        {hackathonsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
            {[...Array(4)].map((_, index) => (
              <SkeletonHackathonCard key={index} />
            ))}
          </div>
        ) : hackathonsError ? (
          <div className="mt-4 text-red-500">Failed to load hackathons.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
            {Array.isArray(hackathons) &&
              hackathons.map((hackathon: any) => (
                <HackathonCard
                  key={hackathon.id}
                  id={hackathon.id}
                  number={hackathon.hackathon_number}
                  date={hackathon.date}
                  numberOfUpdates={hackathon.updates.length}
                  hostName={hackathon.host?.name || "unknown host"}
                  updates={hackathon.updates}
                  mutateHackathons={mutateHackathons}
                />
              ))}
          </div>
        )}
      </div>

      {/* Members */}
      <div className="mt-10">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-semibold">Active Members</h2>
          <Link
            href="/members"
            className="flex items-center gap-x-2 dark:bg-white dark:hover:bg-[#e0e0e0] dark:text-black transition duration-200 bg-gray-800 hover:bg-gray-950 py-2 px-6 rounded-full font-semibold text-white"
          >
            <CircleArrowRight size="18" />
            View All
          </Link>
        </div>
        {membersLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
            {[...Array(4)].map((_, index) => (
              <SkeletonMemberCard key={index} />
            ))}
          </div>
        ) : membersError ? (
          <div className="mt-4 text-red-500">Failed to load active members.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
            {Array.isArray(members) &&
              members.map((member: any) => (
                <MemberCard
                  key={member.id}
                  {...member}
                  mutateMembers={mutateMembers}
                />
              ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
