import { ActionForm } from "@/components/ui/action-form";
import { logoutAction } from "@/app/(auth)/actions";

export function LogoutButton() {
  return <ActionForm action={logoutAction} submitLabel="Вийти">{null}</ActionForm>;
}