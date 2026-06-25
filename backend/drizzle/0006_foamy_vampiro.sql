ALTER TABLE "matches" ADD COLUMN "organization" varchar(10) DEFAULT 'PSMOC' NOT NULL;
--> statement-breakpoint
-- Remap legacy USPSA division display-names to canonical division keys.
-- Applied to every table that stores a division value.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['registrations', 'scores', 'user_divisions', 'stage_results', 'match_results']
  LOOP
    EXECUTE format($f$
      UPDATE %I SET division = CASE division
        WHEN 'Open'           THEN 'open'
        WHEN 'Production'     THEN 'production'
        WHEN 'Single Stack'   THEN 'classic'
        WHEN 'Carry Optics'   THEN 'production_optics'
        WHEN 'Limited Optics' THEN 'optics'
        WHEN 'Limited'        THEN 'standard'
        WHEN 'Revolver'       THEN 'revolver'
        WHEN 'PCC'            THEN 'pcc_optics'
        ELSE division
      END
      WHERE division IN ('Open','Production','Single Stack','Carry Optics','Limited Optics','Limited','Revolver','PCC')
    $f$, tbl);
  END LOOP;
END $$;
--> statement-breakpoint
-- Default-division on users follows the same mapping.
UPDATE "users" SET default_division = CASE default_division
  WHEN 'Open'           THEN 'open'
  WHEN 'Production'     THEN 'production'
  WHEN 'Single Stack'   THEN 'classic'
  WHEN 'Carry Optics'   THEN 'production_optics'
  WHEN 'Limited Optics' THEN 'optics'
  WHEN 'Limited'        THEN 'standard'
  WHEN 'Revolver'       THEN 'revolver'
  WHEN 'PCC'            THEN 'pcc_optics'
  ELSE default_division
END
WHERE default_division IN ('Open','Production','Single Stack','Carry Optics','Limited Optics','Limited','Revolver','PCC');