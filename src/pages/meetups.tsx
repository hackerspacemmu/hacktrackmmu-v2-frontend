import DashboardLayout from "@/components/DashboardLayout";
import { ErrorPage } from "@/components/errorComponent";
import HackathonCard from "@/components/HackathonCard";
import MeetupCard from "@/components/MeetupCard";
import SkeletonHackathonCard from "@/components/skeletonComponents/SkeletonHackathonCard";
import SkeletonMeetupCard from "@/components/skeletonComponents/SkeletonMeetupCard";
import useAuthStore from "@/store/useAuthStore";
import { apiUrl } from "@/utils/env";
import axios from "axios";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, useCallback } from "react";

export default function Meetups() {
  const { token } = useAuthStore();
  const [paginationNumber, setPaginationNumber] = useState<number>(1);
  const [totalPagination, setTotalPagination] = useState<number>(1);
  const [meetups, setMeetups] = useState<any>();
  const [hackathons, setHackathons] = useState<any>();
  const [isError, setIsError] = useState<any>();
  const [isLoading, setIsLoading] = useState(true);

  // Extract getData and wrap in useCallback so we can use it as a mutation trigger
  const getData = useCallback(
    async (showLoadingState = true) => {
      if (showLoadingState) setIsLoading(true);
      try {
        const response = await axios.get(
          `${apiUrl}/api/v1/meetups/?page=${paginationNumber}`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );
        setMeetups(response.data.data.regular_meetups);
        setHackathons(response.data.data.hackathons);
        setTotalPagination(response.data.meta.regular_meetups.total_pages);
        if (showLoadingState) setIsLoading(false);
      } catch (error: any) {
        if (showLoadingState) setIsLoading(false);
        setIsError(true);
        console.log("Error occured and caught", error);
      }
    },
    [paginationNumber, token],
  );

  useEffect(() => {
    getData();
  }, [getData]);

  // Create a silent re-fetch function to avoid screen flickering when saving
  const handleMutate = async () => {
    await getData(false);
  };

  if (isLoading) {
    return (
      <DashboardLayout pageTitle="HackTrack - Meetups">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold">Meetups</h1>
          <div className="flex items-center border-2 border-gray-200 rounded-full w-fit">
            <button
              onClick={() =>
                setPaginationNumber((prev) => (prev - 1 < 1 ? prev : prev - 1))
              }
              className="text-black bg-white py-2 px-2 rounded-l-full transition duration-200 hover:bg-gray-200 active:bg-gray-400"
            >
              <ChevronLeft />
            </button>
            <div className="text-black bg-white w-[75px] py-2 px-2 text-center">
              {paginationNumber} - {totalPagination}
            </div>
            <button
              onClick={() =>
                setPaginationNumber((prev) =>
                  prev + 1 > totalPagination ? prev : prev + 1,
                )
              }
              className="text-black bg-white py-2 px-2 rounded-r-full transition duration-200 hover:bg-gray-200 active:bg-gray-400"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
        <div className="mt-10">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-semibold">Regular Meetups</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
            {[...Array(28)].map((_, index) => (
              <SkeletonMeetupCard key={index} />
            ))}
          </div>
        </div>

        <div className="mt-10">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl flex items-center font-semibold">
              Hackathons
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
            {[...Array(28)].map((_, index) => (
              <SkeletonHackathonCard key={index} />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isError) {
    return <ErrorPage />;
  }

  return (
    <DashboardLayout pageTitle="HackTrack - Meetups">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold">Meetups</h1>
        <div className="flex items-center border-2 border-gray-200 rounded-full w-fit">
          <button
            onClick={() =>
              setPaginationNumber((prev) => (prev - 1 < 1 ? prev : prev - 1))
            }
            className="text-black bg-white py-2 px-2 rounded-l-full transition duration-200 hover:bg-gray-200 active:bg-gray-400"
          >
            <ChevronLeft />
          </button>
          <div className="text-black bg-white w-[75px] py-2 px-2 text-center">
            {paginationNumber} - {totalPagination}
          </div>
          <button
            onClick={() =>
              setPaginationNumber((prev) =>
                prev + 1 > totalPagination ? prev : prev + 1,
              )
            }
            className="text-black bg-white py-2 px-2 rounded-r-full transition duration-200 hover:bg-gray-200 active:bg-gray-400"
          >
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="mt-10">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-semibold">Regular Meetups</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
          {meetups &&
            meetups.map((meetup: any) => (
              <MeetupCard
                key={meetup.id}
                id={meetup.id}
                number={meetup.number}
                date={meetup.date}
                numberOfUpdates={meetup.updates.length}
                hostName={
                  (meetup.host && meetup.host.name && meetup.host.name) || "N/A"
                }
                updates={meetup.updates}
                mutateMeetups={handleMutate}
              />
            ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl flex items-center font-semibold">
            Hackathons
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
          {hackathons &&
            hackathons.map((meetup: any) => (
              <HackathonCard
                key={meetup.id}
                id={meetup.id}
                number={meetup.hackathon_number}
                date={meetup.date}
                numberOfUpdates={meetup.updates.length}
                hostName={
                  (meetup.host && meetup.host.name && meetup.host.name) || "N/A"
                }
                updates={meetup.updates}
                mutateHackathons={handleMutate}
              />
            ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
