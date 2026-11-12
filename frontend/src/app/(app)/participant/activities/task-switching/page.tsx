import type { Metadata } from "next";
import { TaskSwitchingActivity } from "@/features/activities/task-switching/task-switching-activity";

export const metadata: Metadata = {
  title: "Task Switching",
  description:
    "Interactive Task Switching task: sort a coloured shape by colour or by shape, with practice and scored trials.",
};

export default function TaskSwitchingPage() {
  return <TaskSwitchingActivity />;
}
