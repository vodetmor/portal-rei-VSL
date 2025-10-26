'use client';
import React, { useState } from 'react';
import { Check, X, Layers, Gem, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false);

  const plans = [
    {
      id: "free",
      name: "Grátis",
      description: "Para começar a explorar o potencial das suas ideias.",
      icon: <Layers className="w-8 h-8 text-primary" />,
      priceMonthly: 0,
      priceYearly: 0,
      features: [
        { label: "3 Gerações de ideias", included: true },
        { label: "3 Validações de ideias", included: true },
        { label: "Acesso à comunidade", included: true },
        { label: "Suporte prioritário", included: false },
        { label: "Exportar relatórios (PDF)", included: false },
      ],
    },
    {
      id: "pro",
      name: "Pro",
      description: "Para empreendedores e startups em crescimento.",
      icon: <Gem className="w-8 h-8 text-primary" />,
      priceMonthly: 49,
      priceYearly: 490,
      features: [
        { label: "Gerações de ideias ilimitadas", included: true },
        { label: "Validações de ideias ilimitadas", included: true },
        { label: "Acesso à comunidade", included: true },
        { label: "Suporte prioritário", included: true },
        { label: "Exportar relatórios (PDF)", included: false },
      ],
      recommended: true,
    },
    {
      id: "premium",
      name: "Premium",
      description: "Para equipes e agências que precisam de mais.",
      icon: <Crown className="w-8 h-8 text-primary" />,
      priceMonthly: 99,
      priceYearly: 990,
      features: [
        { label: "Gerações de ideias ilimitadas", included: true },
        { label: "Validações de ideias ilimitadas", included: true },
        { label: "Acesso à comunidade", included: true },
        { label: "Suporte prioritário", included: true },
        { label: "Exportar relatórios (PDF)", included: true },
      ],
    },
  ];

  return (
    <div className="text-white py-20 px-4 md:px-8 w-full transition-colors duration-300 z-10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold tracking-tight mb-2">
            Um plano para cada estágio da sua jornada
          </h2>
          <p className="text-muted-foreground mb-8">
            Comece de graça e evolua conforme sua ideia ganha vida.
          </p>

          <div className="flex flex-col items-center justify-center gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                Mensal
              </span>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isAnnual}
                  onChange={(e) => setIsAnnual(e.target.checked)}
                />
                <div className="w-12 h-6 bg-muted/50 rounded-full peer-focus:ring-4 peer-focus:ring-primary/50 peer-checked:bg-primary transition-colors relative">
                  <span className="absolute top-[2px] left-[2px] w-5 h-5 bg-foreground rounded-full shadow-md transform transition-transform peer-checked:translate-x-6"></span>
                </div>
              </label>

              <span className="text-sm font-medium text-muted-foreground">
                Anual
              </span>
            </div>

            <span className="text-sm text-primary">
              Pague anualmente e economize 20%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(`relative bg-card border rounded-xl shadow-sm transition-all hover:shadow-lg hover:scale-[1.02]`,
                plan.recommended
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-border'
              )}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-0 right-0 mx-auto w-fit bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">
                  Recomendado
                </div>
              )}

              <div className="text-center pt-8 px-6">
                <div className="flex justify-center mb-4">{plan.icon}</div>
                <h3 className="text-xl font-semibold mb-1 text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div className="px-6 pb-6 mt-6">
                <div className="text-center mb-6">
                  <div className="text-4xl font-bold mb-1 text-foreground transition-all duration-300">
                    {plan.priceMonthly === 0 ? 'Grátis' : `R$ ${isAnnual ? plan.priceYearly / 10 : plan.priceMonthly}`}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    / {plan.priceMonthly === 0 ? 'Sempre' : (isAnnual ? "ano" : "mês")}
                  </p>
                </div>

                <button
                  className={cn(`w-full py-2.5 px-4 rounded-lg font-medium transition-colors mb-6`,
                    plan.recommended
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-foreground hover:bg-muted/80'
                  )}
                >
                  Começar Agora
                </button>

                <div className="text-left text-sm">
                  <h4 className="font-semibold mb-3 text-foreground">O que está incluído:</h4>
                  <ul className="space-y-2">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        {feature.included ? (
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                        )}
                        <span
                          className={
                            feature.included
                              ? "text-muted-foreground"
                              : "text-muted-foreground/50 line-through"
                          }
                        >
                          {feature.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
