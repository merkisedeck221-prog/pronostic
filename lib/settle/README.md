# lib/settle

Résolution des pronostics (section 5, F7) : après un match au statut final (`FT`, `AET`, `PEN`), calcul de `won`, `lost` ou `void` à partir du score au **temps réglementaire** (prolongations et tirs au but exclus). Remboursement des matchs annulés ou reportés de plus de 48 h (RG-F5-7).

La résolution est idempotente : relancée, elle ne change rien.
