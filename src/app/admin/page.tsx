import { redirect } from "next/navigation";

/** Legacy path — management users live under /manage/users */
export default function AdminRedirect() {
  redirect("/manage/users");
}
