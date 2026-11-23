"use client";

import Link from "next/link";
import { ChevronDownIcon, LogOutIcon, ShieldIcon, UserIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/auth/actions";

/** Menu utilisateur de l'en-tête : Profil, (Administration), Déconnexion. */
export function UserMenu({ displayName, isAdmin }: { displayName: string; isAdmin: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <UserIcon />
        <span className="max-w-28 truncate">{displayName}</span>
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Base UI : un GroupLabel doit être dans un Group (sinon erreur #31 à l'ouverture). */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profil" />}>
          <UserIcon />
          Profil
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <ShieldIcon />
            Administration
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void signOutAction()}>
          <LogOutIcon />
          Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
