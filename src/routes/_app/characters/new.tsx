import { createFileRoute } from "@tanstack/react-router";
import { CharacterForm } from "@/components/CharacterForm";

export const Route = createFileRoute("/_app/characters/new")({
  component: () => (
    <CharacterForm
      mode="create"
      initial={{
        name: "",
        gender: "",
        age_range: "",
        description: "",
        detox_mode: false,
        speed: "medium",
      }}
    />
  ),
  head: () => ({ meta: [{ title: "新建角色 — Persona" }] }),
});
