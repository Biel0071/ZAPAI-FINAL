import React from "react";
import { AgentIdentity } from "./AgentIdentity";
import { AgentCharacterRenderer } from "./AgentCharacterRenderer";

export interface AgentCharacterProps {
  agent: AgentIdentity;
  pose: "seated" | "standing";
  isTyping?: boolean;
  className?: string;
  onClick?: () => void;
}

/**
 * AgentCharacter — High-Fidelity 2.5D Digital Employee Component
 * Replaces legacy vector/geometric SVG primitives with a layered asset-driven
 * architecture: CharacterDefinition -> CharacterAssets -> CharacterPose -> AnimationController -> StateMachine.
 */
export const AgentCharacter: React.FC<AgentCharacterProps> = ({
  agent,
  pose,
  isTyping = false,
  className,
  onClick,
}) => {
  return (
    <AgentCharacterRenderer
      agent={agent}
      pose={pose}
      isTyping={isTyping}
      className={className}
      onClick={onClick}
    />
  );
};
