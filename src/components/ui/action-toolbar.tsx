"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToolbarButton {
  label: string;
  icon?: React.ReactNode;
  count?: number;
  onClick?: () => void;
  dropdownItems?: string[];
  active?: boolean;
}

interface ActionToolbarProps {
  buttons: ToolbarButton[];
  compact?: boolean;
  className?: string;
}

export function ActionToolbar({ buttons, compact = false, className = "" }: ActionToolbarProps) {
  const [activeStates, setActiveStates] = useState<boolean[]>(
    buttons.map((btn) => !!btn.active)
  );

  const handleButtonClick = (index: number, onClick?: () => void) => {
    // For simple buttons, just call onClick. State for toggle buttons is not managed here.
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      className={cn(
        "relative z-0 flex flex-wrap items-center rounded-2xl border border-muted bg-gradient-to-b from-background to-muted/30 p-1 shadow-sm",
        className
      )}
    >
      {buttons.map((btn, index) => {
        const isActive = activeStates[index]; // Note: This state is currently not updated for non-toggle buttons

        const buttonClasses = cn(
          "flex items-center gap-2 px-3 h-9 rounded-xl transition-all duration-200",
           // Active state styling might need adjustment based on button type
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "hover:bg-muted/80 hover:text-foreground text-muted-foreground"
        );

        if (btn.dropdownItems) {
          return (
            <div key={index} className="flex items-center">
              <Button
                onMouseDown={(e) => e.preventDefault()} // Prevents loss of text selection
                onClick={() => handleButtonClick(index, btn.onClick)}
                variant="ghost"
                className={cn(buttonClasses, compact && "px-2")}
              >
                {btn.icon}
                {!compact && <span className="font-medium">{btn.label}</span>}
                {btn.count !== undefined && (
                  <Badge
                    variant={isActive ? "secondary" : "outline"}
                    className="text-xs font-mono -me-1"
                  >
                    {btn.count}
                  </Badge>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="ml-0.5 h-9 w-8 rounded-xl hover:bg-muted/80"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {btn.dropdownItems.map((item, i) => (
                    <DropdownMenuItem key={i} onClick={() => console.log(item)}>
                      {item}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        }

        return (
          <Button
            key={index}
            onMouseDown={(e) => e.preventDefault()} // Prevents loss of text selection
            onClick={() => handleButtonClick(index, btn.onClick)}
            variant="ghost"
            className={cn(buttonClasses, compact && "px-2")}
          >
            {btn.icon}
            {!compact && <span className="font-medium">{btn.label}</span>}
            {btn.count !== undefined && (
              <Badge
                variant={isActive ? "secondary" : "outline"}
                className="text-xs font-mono -me-1"
              >
                {btn.count}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}
