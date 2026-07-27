


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, role, status)
  values (new.id, new.email, 'viewer', 'pending')
  on conflict (id) do nothing;
  return new;
end $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'approved');
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_approved"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'approved');
$$;


ALTER FUNCTION "public"."is_approved"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_row_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_old jsonb := to_jsonb(OLD);
  v_row_id text;
begin
  v_row_id := coalesce(v_old->>'id', v_old->>'key');
  insert into record_history (table_name, row_id, action, old_data, changed_by)
  values (TG_TABLE_NAME, v_row_id, lower(TG_OP), v_old, auth.uid());

  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end $$;


ALTER FUNCTION "public"."log_row_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_primary_record"("rec_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_pile uuid; v_stage text;
begin
  if not exists (select 1 from profiles p where p.id=auth.uid()
      and p.status='approved' and p.role in ('admin','recorder')) then
    raise exception 'not allowed';
  end if;
  select pile_id, pile_stage into v_pile, v_stage
    from asbuilt_records where id = rec_id;
  update asbuilt_records set is_primary=false
    where pile_id=v_pile and pile_stage is not distinct from v_stage;
  update asbuilt_records set is_primary=true where id=rec_id;
end $$;


ALTER FUNCTION "public"."set_primary_record"("rec_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."asbuilt_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pile_id" "uuid" NOT NULL,
    "station_id" "uuid",
    "backsight_id" "uuid",
    "bs_measured_n" numeric,
    "bs_measured_e" numeric,
    "measured_seabed" numeric,
    "surveyor" "text",
    "measured_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "is_shared" boolean DEFAULT false NOT NULL,
    "results" "jsonb",
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "measured_time" timestamp with time zone DEFAULT "now"(),
    "note" "text",
    "pile_stage" "text",
    "is_primary" boolean DEFAULT false NOT NULL,
    CONSTRAINT "asbuilt_records_pile_stage_check" CHECK (("pile_stage" = ANY (ARRAY['before'::"text", 'after'::"text"])))
);


ALTER TABLE "public"."asbuilt_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."benchmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "northing" numeric NOT NULL,
    "easting" numeric NOT NULL,
    "elevation" numeric,
    "type" "text" DEFAULT 'BM'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "note" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."benchmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."piles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pile_no" "text" NOT NULL,
    "pile_size" "text",
    "dia_mm" numeric NOT NULL,
    "pile_top_level" numeric,
    "sea_bed_level" numeric,
    "pile_toe_level" numeric,
    "length_m" numeric,
    "incline" "text" DEFAULT 'VERT.'::"text" NOT NULL,
    "coordinate_pn" numeric NOT NULL,
    "coordinate_pe" numeric NOT NULL,
    "utm_n" numeric,
    "utm_e" numeric,
    "coating_length_m" numeric,
    "batter_bearing_deg" numeric,
    "note" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "toe_pn" numeric,
    "toe_pe" numeric,
    "zone" "text"
);


ALTER TABLE "public"."piles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "role" "text" DEFAULT 'viewer'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'recorder'::"text", 'viewer'::"text"]))),
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_settings" (
    "key" "text" NOT NULL,
    "value" numeric NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."project_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."record_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" "text" NOT NULL,
    "row_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "old_data" "jsonb" NOT NULL,
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "record_history_action_check" CHECK (("action" = ANY (ARRAY['update'::"text", 'delete'::"text"])))
);


ALTER TABLE "public"."record_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."record_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "record_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "photo_type" "text" DEFAULT 'pile'::"text" NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "record_photos_photo_type_check" CHECK (("photo_type" = ANY (ARRAY['pile'::"text", 'ts_screen'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."record_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."survey_points" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "record_id" "uuid" NOT NULL,
    "point_no" integer NOT NULL,
    "northing" numeric NOT NULL,
    "easting" numeric NOT NULL,
    "elevation" numeric NOT NULL,
    "note" "text",
    CONSTRAINT "survey_points_point_no_check" CHECK ((("point_no" >= 1) AND ("point_no" <= 9)))
);


ALTER TABLE "public"."survey_points" OWNER TO "postgres";


ALTER TABLE ONLY "public"."asbuilt_records"
    ADD CONSTRAINT "asbuilt_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."benchmarks"
    ADD CONSTRAINT "benchmarks_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."benchmarks"
    ADD CONSTRAINT "benchmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."piles"
    ADD CONSTRAINT "piles_pile_no_key" UNIQUE ("pile_no");



ALTER TABLE ONLY "public"."piles"
    ADD CONSTRAINT "piles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_settings"
    ADD CONSTRAINT "project_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."record_history"
    ADD CONSTRAINT "record_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."record_photos"
    ADD CONSTRAINT "record_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."survey_points"
    ADD CONSTRAINT "survey_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."survey_points"
    ADD CONSTRAINT "survey_points_record_id_point_no_key" UNIQUE ("record_id", "point_no");



CREATE UNIQUE INDEX "one_primary_per_pile_stage" ON "public"."asbuilt_records" USING "btree" ("pile_id", "pile_stage") WHERE "is_primary";



CREATE INDEX "record_history_changed_at_idx" ON "public"."record_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "record_history_table_name_row_id_idx" ON "public"."record_history" USING "btree" ("table_name", "row_id");



CREATE OR REPLACE TRIGGER "asbuilt_records_updated_at" BEFORE UPDATE ON "public"."asbuilt_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_history_asbuilt_records" BEFORE DELETE OR UPDATE ON "public"."asbuilt_records" FOR EACH ROW EXECUTE FUNCTION "public"."log_row_history"();



CREATE OR REPLACE TRIGGER "trg_history_benchmarks" BEFORE DELETE OR UPDATE ON "public"."benchmarks" FOR EACH ROW EXECUTE FUNCTION "public"."log_row_history"();



CREATE OR REPLACE TRIGGER "trg_history_piles" BEFORE DELETE OR UPDATE ON "public"."piles" FOR EACH ROW EXECUTE FUNCTION "public"."log_row_history"();



CREATE OR REPLACE TRIGGER "trg_history_profiles" BEFORE DELETE OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."log_row_history"();



CREATE OR REPLACE TRIGGER "trg_history_project_settings" BEFORE DELETE OR UPDATE ON "public"."project_settings" FOR EACH ROW EXECUTE FUNCTION "public"."log_row_history"();



ALTER TABLE ONLY "public"."asbuilt_records"
    ADD CONSTRAINT "asbuilt_records_backsight_id_fkey" FOREIGN KEY ("backsight_id") REFERENCES "public"."benchmarks"("id");



ALTER TABLE ONLY "public"."asbuilt_records"
    ADD CONSTRAINT "asbuilt_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."asbuilt_records"
    ADD CONSTRAINT "asbuilt_records_pile_id_fkey" FOREIGN KEY ("pile_id") REFERENCES "public"."piles"("id");



ALTER TABLE ONLY "public"."asbuilt_records"
    ADD CONSTRAINT "asbuilt_records_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."benchmarks"("id");



ALTER TABLE ONLY "public"."benchmarks"
    ADD CONSTRAINT "benchmarks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."piles"
    ADD CONSTRAINT "piles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."record_history"
    ADD CONSTRAINT "record_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."record_photos"
    ADD CONSTRAINT "record_photos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."record_photos"
    ADD CONSTRAINT "record_photos_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "public"."asbuilt_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."survey_points"
    ADD CONSTRAINT "survey_points_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "public"."asbuilt_records"("id") ON DELETE CASCADE;



ALTER TABLE "public"."asbuilt_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."benchmarks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bm admin write" ON "public"."benchmarks" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "bm insert recorder" ON "public"."benchmarks" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."status" = 'approved'::"text") AND ("p"."role" = ANY (ARRAY['admin'::"text", 'recorder'::"text"]))))));



CREATE POLICY "bm public read" ON "public"."benchmarks" FOR SELECT USING (true);



CREATE POLICY "history read" ON "public"."record_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."status" = 'approved'::"text") AND ("p"."role" = ANY (ARRAY['admin'::"text", 'recorder'::"text"]))))));



CREATE POLICY "photos read" ON "public"."record_photos" FOR SELECT USING (true);



CREATE POLICY "photos write" ON "public"."record_photos" TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."status" = 'approved'::"text") AND ("p"."role" = ANY (ARRAY['admin'::"text", 'recorder'::"text"]))))))) WITH CHECK ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."status" = 'approved'::"text") AND ("p"."role" = ANY (ARRAY['admin'::"text", 'recorder'::"text"])))))));



ALTER TABLE "public"."piles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "piles admin write" ON "public"."piles" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "piles public read" ON "public"."piles" FOR SELECT USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles admin write" ON "public"."profiles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "profiles read" ON "public"."profiles" FOR SELECT USING (true);



ALTER TABLE "public"."project_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pt public read" ON "public"."survey_points" FOR SELECT USING (true);



CREATE POLICY "pt write" ON "public"."survey_points" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."asbuilt_records" "r"
  WHERE (("r"."id" = "survey_points"."record_id") AND ("r"."created_by" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."asbuilt_records" "r"
  WHERE (("r"."id" = "survey_points"."record_id") AND ("r"."created_by" = "auth"."uid"())))));



CREATE POLICY "rec delete" ON "public"."asbuilt_records" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."status" = 'approved'::"text") AND ("p"."role" = ANY (ARRAY['admin'::"text", 'recorder'::"text"])))))));



CREATE POLICY "rec insert" ON "public"."asbuilt_records" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."status" = 'approved'::"text") AND ("p"."role" = ANY (ARRAY['admin'::"text", 'recorder'::"text"])))))));



CREATE POLICY "rec public read" ON "public"."asbuilt_records" FOR SELECT USING (true);



CREATE POLICY "rec update" ON "public"."asbuilt_records" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."status" = 'approved'::"text") AND ("p"."role" = ANY (ARRAY['admin'::"text", 'recorder'::"text"])))))));



ALTER TABLE "public"."record_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."record_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settings admin write" ON "public"."project_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "settings public read" ON "public"."project_settings" FOR SELECT USING (true);



CREATE POLICY "settings read" ON "public"."project_settings" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."survey_points" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_approved"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_approved"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_approved"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_row_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_row_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_row_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_primary_record"("rec_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_primary_record"("rec_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_primary_record"("rec_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."asbuilt_records" TO "anon";
GRANT ALL ON TABLE "public"."asbuilt_records" TO "authenticated";
GRANT ALL ON TABLE "public"."asbuilt_records" TO "service_role";



GRANT ALL ON TABLE "public"."benchmarks" TO "anon";
GRANT ALL ON TABLE "public"."benchmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."benchmarks" TO "service_role";



GRANT ALL ON TABLE "public"."piles" TO "anon";
GRANT ALL ON TABLE "public"."piles" TO "authenticated";
GRANT ALL ON TABLE "public"."piles" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_settings" TO "anon";
GRANT ALL ON TABLE "public"."project_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."project_settings" TO "service_role";



GRANT ALL ON TABLE "public"."record_history" TO "anon";
GRANT ALL ON TABLE "public"."record_history" TO "authenticated";
GRANT ALL ON TABLE "public"."record_history" TO "service_role";



GRANT ALL ON TABLE "public"."record_photos" TO "anon";
GRANT ALL ON TABLE "public"."record_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."record_photos" TO "service_role";



GRANT ALL ON TABLE "public"."survey_points" TO "anon";
GRANT ALL ON TABLE "public"."survey_points" TO "authenticated";
GRANT ALL ON TABLE "public"."survey_points" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







