"use client";

import * as React from "react";

export function GlassFilter() {
    return (
      <svg className="hidden">
        <defs>
          <filter
            id="container-glass"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            {/* Generate turbulent noise for distortion */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.05 0.05"
              numOctaves="1"
              seed="1"
              result="turbulence"
            />
             {/* Blur the turbulence pattern slightly */}
            <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
             {/* Displace the source graphic with the noise */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="blurredNoise"
              scale="70"
              xChannelSelector="R"
              yChannelSelector="B"
              result="displaced"
            />
             {/* Apply overall blur on the final result */}
            <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
             {/* Output the result */}
            <feComposite in="finalBlur" in2="finalBlur" operator="over" />
          </filter>
        </defs>
      </svg>
    );
  }
  