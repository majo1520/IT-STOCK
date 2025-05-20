--
-- PostgreSQL database dump
--

-- Dumped from database version 15.12 (Debian 15.12-0+deb12u2)
-- Dumped by pg_dump version 15.12 (Debian 15.12-0+deb12u2)

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

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: test_schema; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA test_schema;


ALTER SCHEMA test_schema OWNER TO postgres;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA test_schema;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: box_location; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.box_location AS ENUM (
    'IT OFFICE',
    'IT HOUSE',
    'SERVER ROOM',
    'FINANCIAL STOCK'
);


ALTER TYPE public.box_location OWNER TO postgres;

--
-- Name: box_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.box_status AS ENUM (
    'Available',
    'In Use',
    'Maintenance',
    'Retired'
);


ALTER TYPE public.box_status OWNER TO postgres;

--
-- Name: shelf_location; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.shelf_location AS ENUM (
    'A1',
    'A2',
    'A3',
    'A4',
    'B1',
    'B2',
    'B3',
    'B4',
    'C1',
    'C2',
    'C3',
    'C4',
    'D1',
    'D2',
    'D3',
    'D4',
    'E1',
    'E2',
    'E3',
    'E4',
    'F1',
    'F2',
    'F3',
    'F4'
);


ALTER TYPE public.shelf_location OWNER TO postgres;

--
-- Name: inventory_transaction_type; Type: TYPE; Schema: test_schema; Owner: postgres
--

CREATE TYPE test_schema.inventory_transaction_type AS ENUM (
    'in',
    'out',
    'transfer',
    'adjustment'
);


ALTER TYPE test_schema.inventory_transaction_type OWNER TO postgres;

--
-- Name: item_status; Type: TYPE; Schema: test_schema; Owner: postgres
--

CREATE TYPE test_schema.item_status AS ENUM (
    'active',
    'maintenance',
    'archived',
    'deleted'
);


ALTER TYPE test_schema.item_status OWNER TO postgres;

--
-- Name: generate_box_barcode(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_box_barcode() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  location_code VARCHAR;
  shelf_code VARCHAR;
  box_ref VARCHAR;
BEGIN
  -- Get location code (first 2 chars)
  IF NEW.location_id IS NOT NULL THEN
    SELECT SUBSTRING(UPPER(name), 1, 2) INTO location_code FROM locations WHERE id = NEW.location_id;
  ELSE
    location_code := 'XX';
  END IF;

  -- Get shelf code
  IF NEW.shelf_id IS NOT NULL THEN
    SELECT SUBSTRING(UPPER(name), 1, 2) INTO shelf_code FROM shelves WHERE id = NEW.shelf_id;
  ELSE
    shelf_code := 'XX';
  END IF;

  -- Create a short version of the UUID (last 8 chars)
  box_ref := SUBSTRING(NEW.reference_uuid::text, 25, 8);
  
  -- Format: LC-SC-BN-REF where:
  -- LC = Location Code (2 chars)
  -- SC = Shelf Code (2 chars)
  -- BN = Box Number (padded)
  -- REF = Reference UUID (8 chars)
  NEW.barcode_data := location_code || shelf_code || 
                      LPAD(NEW.box_number::text, 4, '0') || 
                      box_ref;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.generate_box_barcode() OWNER TO postgres;

--
-- Name: refresh_items_complete_view(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_items_complete_view() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Use non-concurrent refresh since we now have a unique index
    REFRESH MATERIALIZED VIEW items_complete_view;
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.refresh_items_complete_view() OWNER TO postgres;

--
-- Name: refresh_items_view_func(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_items_view_func() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY items_complete_view;
        RETURN NULL;
      END;
      $$;


ALTER FUNCTION public.refresh_items_view_func() OWNER TO postgres;

--
-- Name: set_customer_transaction_item_name(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_customer_transaction_item_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
                BEGIN
                  IF NEW.item_id IS NOT NULL AND NEW.item_name IS NULL THEN
                    SELECT name INTO NEW.item_name FROM items WHERE id = NEW.item_id;
                  END IF;
                  RETURN NEW;
                END;
                $$;


ALTER FUNCTION public.set_customer_transaction_item_name() OWNER TO postgres;

--
-- Name: set_transaction_item_name(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_transaction_item_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.item_id IS NOT NULL AND NEW.item_name IS NULL THEN
    SELECT name INTO NEW.item_name FROM items WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_transaction_item_name() OWNER TO postgres;

--
-- Name: soft_delete_box(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.soft_delete_box() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Instead of actually deleting the row, just set the deleted_at timestamp
  UPDATE boxes SET deleted_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  
  -- Add a record to transactions
  INSERT INTO transactions (
    box_id, 
    transaction_type, 
    notes, 
    created_by
  ) VALUES (
    OLD.id, 
    'DELETE_BOX', 
    'Box was deleted. Reference ID ' || OLD.reference_uuid || ' preserved.', 
    CURRENT_USER
  );
  
  -- Prevent the actual deletion
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.soft_delete_box() OWNER TO postgres;

--
-- Name: update_modified_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$;


ALTER FUNCTION public.update_modified_column() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    quantity integer DEFAULT 1 NOT NULL,
    box_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    supplier character varying(100),
    parent_item_id integer,
    type character varying(100),
    ean_code character varying(100),
    serial_number character varying(100),
    qr_code character varying(255),
    deleted_at timestamp with time zone
);


ALTER TABLE public.items OWNER TO postgres;

--
-- Name: COLUMN items.parent_item_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.items.parent_item_id IS 'References the parent item ID for hierarchical relationships';


--
-- Name: COLUMN items.qr_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.items.qr_code IS 'Unique QR code identifier for the item';


--
-- Name: active_items; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.active_items AS
 SELECT items.id,
    items.name,
    items.description,
    items.quantity,
    items.box_id,
    items.created_at,
    items.updated_at,
    items.supplier,
    items.parent_item_id,
    items.type,
    items.ean_code,
    items.serial_number,
    items.qr_code,
    items.deleted_at
   FROM public.items
  WHERE (items.deleted_at IS NULL);


ALTER TABLE public.active_items OWNER TO postgres;

--
-- Name: boxes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.boxes (
    id integer NOT NULL,
    box_number character varying(50) NOT NULL,
    description character varying(100),
    serial_number character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    shelf_id integer,
    location_id integer,
    created_by character varying(100),
    reference_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    barcode_data character varying(50),
    deleted_at timestamp with time zone,
    reference_id character varying(50)
);


ALTER TABLE public.boxes OWNER TO postgres;

--
-- Name: COLUMN boxes.reference_uuid; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.boxes.reference_uuid IS 'Permanent unique identifier that will never be reused, even after box deletion';


--
-- Name: COLUMN boxes.barcode_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.boxes.barcode_data IS 'Formatted data for Code128 barcode, combining location, shelf, box number and reference';


--
-- Name: COLUMN boxes.deleted_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.boxes.deleted_at IS 'Timestamp when box was deleted (null means active box)';


--
-- Name: COLUMN boxes.reference_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.boxes.reference_id IS 'Unique reference ID for the box, used for QR codes and labels';


--
-- Name: boxes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.boxes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.boxes_id_seq OWNER TO postgres;

--
-- Name: boxes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.boxes_id_seq OWNED BY public.boxes.id;


--
-- Name: colors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.colors (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    hex_code character varying(7) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.colors OWNER TO postgres;

--
-- Name: colors_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.colors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.colors_id_seq OWNER TO postgres;

--
-- Name: colors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.colors_id_seq OWNED BY public.colors.id;


--
-- Name: customer_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_transactions (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    item_id integer,
    item_name character varying(255),
    quantity integer DEFAULT 1 NOT NULL,
    notes text,
    transaction_type character varying(50) DEFAULT 'CONSUMPTION'::character varying,
    transaction_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    user_id integer
);


ALTER TABLE public.customer_transactions OWNER TO postgres;

--
-- Name: TABLE customer_transactions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.customer_transactions IS 'Stores all customer consumption transactions';


--
-- Name: customer_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.customer_transactions_id_seq OWNER TO postgres;

--
-- Name: customer_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_transactions_id_seq OWNED BY public.customer_transactions.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    contact_person character varying(255),
    email character varying(255),
    phone character varying(50),
    address text,
    group_name character varying(100),
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    role_id character varying(50)
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.customers_id_seq OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: db_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.db_migrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.db_migrations OWNER TO postgres;

--
-- Name: db_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.db_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.db_migrations_id_seq OWNER TO postgres;

--
-- Name: db_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.db_migrations_id_seq OWNED BY public.db_migrations.id;


--
-- Name: groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.groups (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.groups OWNER TO postgres;

--
-- Name: groups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.groups_id_seq OWNER TO postgres;

--
-- Name: groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.groups_id_seq OWNED BY public.groups.id;


--
-- Name: item_properties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.item_properties (
    id integer NOT NULL,
    item_id integer NOT NULL,
    type character varying(100),
    ean_code character varying(100),
    serial_number character varying(100),
    additional_data jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.item_properties OWNER TO postgres;

--
-- Name: TABLE item_properties; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.item_properties IS 'Stores additional item properties that were previously stored in localStorage';


--
-- Name: item_properties_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.item_properties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.item_properties_id_seq OWNER TO postgres;

--
-- Name: item_properties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.item_properties_id_seq OWNED BY public.item_properties.id;


--
-- Name: item_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.item_transactions (
    id integer NOT NULL,
    item_id integer,
    item_name character varying(255),
    transaction_type character varying(50) NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    previous_quantity integer,
    new_quantity integer,
    box_id integer,
    previous_box_id integer,
    new_box_id integer,
    related_item_id integer,
    related_item_name character varying(255),
    customer_id integer,
    supplier character varying(255),
    notes text,
    created_by character varying(100),
    user_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb,
    details text
);


ALTER TABLE public.item_transactions OWNER TO postgres;

--
-- Name: TABLE item_transactions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.item_transactions IS 'Stores all item transaction history, replacing localStorage implementation';


--
-- Name: item_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.item_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.item_transactions_id_seq OWNER TO postgres;

--
-- Name: item_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.item_transactions_id_seq OWNED BY public.item_transactions.id;


--
-- Name: locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.locations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    color character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.locations OWNER TO postgres;

--
-- Name: shelves; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shelves (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    location_id integer,
    color_id integer,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.shelves OWNER TO postgres;

--
-- Name: items_complete_view; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.items_complete_view AS
 SELECT i.id,
    i.name,
    i.description,
    i.quantity,
    i.box_id,
    i.created_at,
    i.updated_at,
    i.supplier,
    i.parent_item_id,
    i.deleted_at,
    i.qr_code,
    COALESCE(i.type, ip.type) AS type,
    COALESCE(i.ean_code, ip.ean_code) AS ean_code,
    COALESCE(i.serial_number, ip.serial_number) AS serial_number,
    b.box_number,
    b.description AS box_description,
    l.name AS location_name,
    l.color AS location_color,
    s.name AS shelf_name,
    p.name AS parent_name
   FROM (((((public.items i
     LEFT JOIN public.boxes b ON ((i.box_id = b.id)))
     LEFT JOIN public.locations l ON ((b.location_id = l.id)))
     LEFT JOIN public.shelves s ON ((b.shelf_id = s.id)))
     LEFT JOIN public.items p ON ((i.parent_item_id = p.id)))
     LEFT JOIN public.item_properties ip ON ((i.id = ip.item_id)))
  WHERE (i.deleted_at IS NULL)
  WITH NO DATA;


ALTER TABLE public.items_complete_view OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.items_id_seq OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- Name: locations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.locations_id_seq OWNER TO postgres;

--
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.migrations OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.migrations_id_seq OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: removal_reasons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.removal_reasons (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.removal_reasons OWNER TO postgres;

--
-- Name: removal_reasons_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.removal_reasons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.removal_reasons_id_seq OWNER TO postgres;

--
-- Name: removal_reasons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.removal_reasons_id_seq OWNED BY public.removal_reasons.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    color character varying(7) DEFAULT '#6c757d'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: TABLE roles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.roles IS 'Stores customer and user roles with their display colors';


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: shelves_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shelves_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.shelves_id_seq OWNER TO postgres;

--
-- Name: shelves_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shelves_id_seq OWNED BY public.shelves.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    box_id integer,
    transaction_type character varying(20) NOT NULL,
    notes text,
    created_by character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    item_id integer,
    user_id integer
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.transactions_id_seq OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: user_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_groups (
    id integer NOT NULL,
    user_id integer NOT NULL,
    group_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_groups OWNER TO postgres;

--
-- Name: user_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_groups_id_seq OWNER TO postgres;

--
-- Name: user_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_groups_id_seq OWNED BY public.user_groups.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(200) NOT NULL,
    email character varying(100),
    full_name character varying(100),
    role character varying(20) DEFAULT 'user'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: boxes; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.boxes (
    id integer NOT NULL,
    box_number character varying(50) NOT NULL,
    description character varying(100),
    location_id integer,
    shelf_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE test_schema.boxes OWNER TO postgres;

--
-- Name: boxes_id_seq; Type: SEQUENCE; Schema: test_schema; Owner: postgres
--

CREATE SEQUENCE test_schema.boxes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE test_schema.boxes_id_seq OWNER TO postgres;

--
-- Name: boxes_id_seq; Type: SEQUENCE OWNED BY; Schema: test_schema; Owner: postgres
--

ALTER SEQUENCE test_schema.boxes_id_seq OWNED BY test_schema.boxes.id;


--
-- Name: item_audit_log; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.item_audit_log (
    id integer NOT NULL,
    item_id integer NOT NULL,
    user_id integer,
    action character varying(50) NOT NULL,
    changed_fields jsonb,
    old_values jsonb,
    new_values jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE test_schema.item_audit_log OWNER TO postgres;

--
-- Name: item_audit_log_id_seq; Type: SEQUENCE; Schema: test_schema; Owner: postgres
--

CREATE SEQUENCE test_schema.item_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE test_schema.item_audit_log_id_seq OWNER TO postgres;

--
-- Name: item_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: test_schema; Owner: postgres
--

ALTER SEQUENCE test_schema.item_audit_log_id_seq OWNED BY test_schema.item_audit_log.id;


--
-- Name: item_images; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.item_images (
    id integer NOT NULL,
    item_id integer NOT NULL,
    image_url text NOT NULL,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE test_schema.item_images OWNER TO postgres;

--
-- Name: item_images_id_seq; Type: SEQUENCE; Schema: test_schema; Owner: postgres
--

CREATE SEQUENCE test_schema.item_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE test_schema.item_images_id_seq OWNER TO postgres;

--
-- Name: item_images_id_seq; Type: SEQUENCE OWNED BY; Schema: test_schema; Owner: postgres
--

ALTER SEQUENCE test_schema.item_images_id_seq OWNED BY test_schema.item_images.id;


--
-- Name: item_properties; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.item_properties (
    id integer NOT NULL,
    item_id integer NOT NULL,
    type character varying(100),
    ean_code character varying(100),
    serial_number character varying(100),
    qr_code character varying(100),
    supplier character varying(200),
    purchase_date date,
    expiry_date date,
    warranty_expiry date,
    cost numeric(10,2),
    additional_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE test_schema.item_properties OWNER TO postgres;

--
-- Name: item_properties_id_seq; Type: SEQUENCE; Schema: test_schema; Owner: postgres
--

CREATE SEQUENCE test_schema.item_properties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE test_schema.item_properties_id_seq OWNER TO postgres;

--
-- Name: item_properties_id_seq; Type: SEQUENCE OWNED BY; Schema: test_schema; Owner: postgres
--

ALTER SEQUENCE test_schema.item_properties_id_seq OWNED BY test_schema.item_properties.id;


--
-- Name: item_tag_relations; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.item_tag_relations (
    item_id integer NOT NULL,
    tag_id integer NOT NULL
);


ALTER TABLE test_schema.item_tag_relations OWNER TO postgres;

--
-- Name: item_tags; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.item_tags (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(7) DEFAULT '#cccccc'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE test_schema.item_tags OWNER TO postgres;

--
-- Name: item_tags_id_seq; Type: SEQUENCE; Schema: test_schema; Owner: postgres
--

CREATE SEQUENCE test_schema.item_tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE test_schema.item_tags_id_seq OWNER TO postgres;

--
-- Name: item_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: test_schema; Owner: postgres
--

ALTER SEQUENCE test_schema.item_tags_id_seq OWNED BY test_schema.item_tags.id;


--
-- Name: item_transactions; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.item_transactions (
    id integer NOT NULL,
    item_id integer NOT NULL,
    type test_schema.inventory_transaction_type NOT NULL,
    quantity integer NOT NULL,
    box_id integer,
    previous_box_id integer,
    user_id integer,
    customer_id integer,
    notes text,
    supplier character varying(200),
    reference_code character varying(100),
    transaction_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE test_schema.item_transactions OWNER TO postgres;

--
-- Name: item_transactions_id_seq; Type: SEQUENCE; Schema: test_schema; Owner: postgres
--

CREATE SEQUENCE test_schema.item_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE test_schema.item_transactions_id_seq OWNER TO postgres;

--
-- Name: item_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: test_schema; Owner: postgres
--

ALTER SEQUENCE test_schema.item_transactions_id_seq OWNED BY test_schema.item_transactions.id;


--
-- Name: items; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.items (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    quantity integer DEFAULT 0 NOT NULL,
    box_id integer,
    parent_item_id integer,
    status test_schema.item_status DEFAULT 'active'::test_schema.item_status NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


ALTER TABLE test_schema.items OWNER TO postgres;

--
-- Name: items_complete_data; Type: MATERIALIZED VIEW; Schema: test_schema; Owner: postgres
--

CREATE MATERIALIZED VIEW test_schema.items_complete_data AS
 WITH item_transactions_summary AS (
         SELECT item_transactions.item_id,
            sum(
                CASE
                    WHEN (item_transactions.type = 'in'::test_schema.inventory_transaction_type) THEN item_transactions.quantity
                    ELSE 0
                END) AS total_in,
            sum(
                CASE
                    WHEN (item_transactions.type = 'out'::test_schema.inventory_transaction_type) THEN item_transactions.quantity
                    ELSE 0
                END) AS total_out,
            sum(
                CASE
                    WHEN (item_transactions.type = 'adjustment'::test_schema.inventory_transaction_type) THEN item_transactions.quantity
                    ELSE 0
                END) AS total_adjustments,
            max(item_transactions.transaction_date) AS last_transaction_date
           FROM test_schema.item_transactions
          GROUP BY item_transactions.item_id
        )
 SELECT i.id,
    i.name,
    i.description,
    i.quantity,
    i.box_id,
    i.parent_item_id,
    i.status,
    i.created_at,
    i.updated_at,
    i.deleted_at,
    ip.type,
    ip.ean_code,
    ip.serial_number,
    ip.qr_code,
    ip.supplier,
    ip.purchase_date,
    ip.warranty_expiry,
    ip.cost,
    b.box_number,
    b.description AS box_description,
    l.name AS location_name,
    s.name AS shelf_name,
    p.name AS parent_name,
    p.id AS parent_id,
    its.total_in,
    its.total_out,
    its.total_adjustments,
    its.last_transaction_date,
    ( SELECT count(*) AS count
           FROM test_schema.items
          WHERE (items.parent_item_id = i.id)) AS subitems_count,
    ( SELECT string_agg((t.name)::text, ', '::text) AS string_agg
           FROM (test_schema.item_tag_relations tr
             JOIN test_schema.item_tags t ON ((tr.tag_id = t.id)))
          WHERE (tr.item_id = i.id)) AS tags
   FROM ((((((test_schema.items i
     LEFT JOIN test_schema.item_properties ip ON ((i.id = ip.item_id)))
     LEFT JOIN public.boxes b ON ((i.box_id = b.id)))
     LEFT JOIN public.locations l ON ((b.location_id = l.id)))
     LEFT JOIN public.shelves s ON ((b.shelf_id = s.id)))
     LEFT JOIN test_schema.items p ON ((i.parent_item_id = p.id)))
     LEFT JOIN item_transactions_summary its ON ((i.id = its.item_id)))
  WHERE ((i.status <> 'deleted'::test_schema.item_status) OR (i.status IS NULL))
  WITH NO DATA;


ALTER TABLE test_schema.items_complete_data OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE; Schema: test_schema; Owner: postgres
--

CREATE SEQUENCE test_schema.items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE test_schema.items_id_seq OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: test_schema; Owner: postgres
--

ALTER SEQUENCE test_schema.items_id_seq OWNED BY test_schema.items.id;


--
-- Name: items_with_properties; Type: VIEW; Schema: test_schema; Owner: postgres
--

CREATE VIEW test_schema.items_with_properties AS
 SELECT i.id,
    i.name,
    i.description,
    i.quantity,
    i.box_id,
    i.parent_item_id,
    i.status,
    i.created_at,
    i.updated_at,
    i.deleted_at,
    ip.type,
    ip.ean_code,
    ip.serial_number,
    ip.qr_code,
    ip.supplier,
    ip.purchase_date,
    ip.expiry_date,
    ip.warranty_expiry,
    ip.cost,
    ip.additional_data,
    b.box_number,
    b.description AS box_description,
    l.name AS location_name,
    s.name AS shelf_name,
    p.name AS parent_name,
    ( SELECT array_agg(t.name) AS array_agg
           FROM (test_schema.item_tag_relations tr
             JOIN test_schema.item_tags t ON ((tr.tag_id = t.id)))
          WHERE (tr.item_id = i.id)) AS tags
   FROM (((((test_schema.items i
     LEFT JOIN test_schema.item_properties ip ON ((i.id = ip.item_id)))
     LEFT JOIN public.boxes b ON ((i.box_id = b.id)))
     LEFT JOIN public.locations l ON ((b.location_id = l.id)))
     LEFT JOIN public.shelves s ON ((b.shelf_id = s.id)))
     LEFT JOIN test_schema.items p ON ((i.parent_item_id = p.id)))
  WHERE ((i.status <> 'deleted'::test_schema.item_status) OR (i.status IS NULL));


ALTER TABLE test_schema.items_with_properties OWNER TO postgres;

--
-- Name: locations; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.locations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(7)
);


ALTER TABLE test_schema.locations OWNER TO postgres;

--
-- Name: locations_id_seq; Type: SEQUENCE; Schema: test_schema; Owner: postgres
--

CREATE SEQUENCE test_schema.locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE test_schema.locations_id_seq OWNER TO postgres;

--
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: test_schema; Owner: postgres
--

ALTER SEQUENCE test_schema.locations_id_seq OWNED BY test_schema.locations.id;


--
-- Name: shelves; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.shelves (
    id integer NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE test_schema.shelves OWNER TO postgres;

--
-- Name: shelves_id_seq; Type: SEQUENCE; Schema: test_schema; Owner: postgres
--

CREATE SEQUENCE test_schema.shelves_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE test_schema.shelves_id_seq OWNER TO postgres;

--
-- Name: shelves_id_seq; Type: SEQUENCE OWNED BY; Schema: test_schema; Owner: postgres
--

ALTER SEQUENCE test_schema.shelves_id_seq OWNED BY test_schema.shelves.id;


--
-- Name: transaction_metadata; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.transaction_metadata (
    transaction_id integer NOT NULL,
    reason_id integer,
    invoice_number character varying(100),
    external_reference character varying(200),
    approved_by integer,
    data jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE test_schema.transaction_metadata OWNER TO postgres;

--
-- Name: boxes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boxes ALTER COLUMN id SET DEFAULT nextval('public.boxes_id_seq'::regclass);


--
-- Name: colors id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.colors ALTER COLUMN id SET DEFAULT nextval('public.colors_id_seq'::regclass);


--
-- Name: customer_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_transactions ALTER COLUMN id SET DEFAULT nextval('public.customer_transactions_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: db_migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.db_migrations ALTER COLUMN id SET DEFAULT nextval('public.db_migrations_id_seq'::regclass);


--
-- Name: groups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.groups ALTER COLUMN id SET DEFAULT nextval('public.groups_id_seq'::regclass);


--
-- Name: item_properties id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_properties ALTER COLUMN id SET DEFAULT nextval('public.item_properties_id_seq'::regclass);


--
-- Name: item_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions ALTER COLUMN id SET DEFAULT nextval('public.item_transactions_id_seq'::regclass);


--
-- Name: items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: removal_reasons id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.removal_reasons ALTER COLUMN id SET DEFAULT nextval('public.removal_reasons_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: shelves id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shelves ALTER COLUMN id SET DEFAULT nextval('public.shelves_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: user_groups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_groups ALTER COLUMN id SET DEFAULT nextval('public.user_groups_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: boxes id; Type: DEFAULT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.boxes ALTER COLUMN id SET DEFAULT nextval('test_schema.boxes_id_seq'::regclass);


--
-- Name: item_audit_log id; Type: DEFAULT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_audit_log ALTER COLUMN id SET DEFAULT nextval('test_schema.item_audit_log_id_seq'::regclass);


--
-- Name: item_images id; Type: DEFAULT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_images ALTER COLUMN id SET DEFAULT nextval('test_schema.item_images_id_seq'::regclass);


--
-- Name: item_properties id; Type: DEFAULT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_properties ALTER COLUMN id SET DEFAULT nextval('test_schema.item_properties_id_seq'::regclass);


--
-- Name: item_tags id; Type: DEFAULT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_tags ALTER COLUMN id SET DEFAULT nextval('test_schema.item_tags_id_seq'::regclass);


--
-- Name: item_transactions id; Type: DEFAULT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_transactions ALTER COLUMN id SET DEFAULT nextval('test_schema.item_transactions_id_seq'::regclass);


--
-- Name: items id; Type: DEFAULT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.items ALTER COLUMN id SET DEFAULT nextval('test_schema.items_id_seq'::regclass);


--
-- Name: locations id; Type: DEFAULT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.locations ALTER COLUMN id SET DEFAULT nextval('test_schema.locations_id_seq'::regclass);


--
-- Name: shelves id; Type: DEFAULT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.shelves ALTER COLUMN id SET DEFAULT nextval('test_schema.shelves_id_seq'::regclass);


--
-- Data for Name: boxes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.boxes (id, box_number, description, serial_number, created_at, updated_at, shelf_id, location_id, created_by, reference_uuid, barcode_data, deleted_at, reference_id) FROM stdin;
1	1			2025-05-08 12:38:20.424696+02	2025-05-14 10:15:31.03914+02	1	1	admin	61268365-968c-4815-ae01-cbeac29e0652	ITA10001cbeac29e	\N	BOX-0001-039140
2	2			2025-05-08 12:51:34.605071+02	2025-05-14 10:15:31.03914+02	2	2	admin	b9720636-360d-4bb7-bfe0-7b7f475abc37	ITIT00027b7f475a	\N	BOX-0002-039140
3	3			2025-05-08 14:09:09.282285+02	2025-05-14 10:15:31.03914+02	\N	4	admin	f4e901cf-9f90-483e-833b-fe7b3eafaad6	FIXX0003fe7b3eaf	\N	BOX-0003-039140
4	100			2025-05-08 14:32:45.339631+02	2025-05-14 10:15:31.03914+02	\N	3	admin	1f7427af-4e38-4f3b-9acc-bec2d56c33bf	SEXX0100bec2d56c	\N	BOX-0100-039140
5	6	\N	\N	2025-05-14 09:14:10.767082+02	2025-05-14 11:51:17.903106+02	\N	4	admin	b3b99dcd-c700-4740-be3f-68aa5d32934a	FIXX000668aa5d32	\N	BOX-0001-039140
6	23			2025-05-14 11:52:24.186171+02	2025-05-14 15:42:20.255568+02	1	1	admin	58a31ad0-b2f5-4c5c-b8dc-03990ee1c826	ITA1002303990ee1	\N	BOX-0023-216344
\.


--
-- Data for Name: colors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.colors (id, name, hex_code, created_at, updated_at) FROM stdin;
1	Red	#FF0000	2025-05-08 23:13:35.095006+02	2025-05-08 23:13:35.095006+02
2	Green	#00FF00	2025-05-08 23:13:35.095006+02	2025-05-08 23:13:35.095006+02
3	Blue	#0000FF	2025-05-08 23:13:35.095006+02	2025-05-08 23:13:35.095006+02
4	Yellow	#FFFF00	2025-05-08 23:13:35.095006+02	2025-05-08 23:13:35.095006+02
5	Purple	#800080	2025-05-08 23:13:35.095006+02	2025-05-08 23:13:35.095006+02
6	Orange	#FFA500	2025-05-08 23:13:35.095006+02	2025-05-08 23:13:35.095006+02
7	Black	#000000	2025-05-08 23:13:35.095006+02	2025-05-08 23:13:35.095006+02
8	White	#FFFFFF	2025-05-08 23:13:35.095006+02	2025-05-08 23:13:35.095006+02
9	Gray	#808080	2025-05-08 23:13:35.095006+02	2025-05-08 23:13:35.095006+02
\.


--
-- Data for Name: customer_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_transactions (id, customer_id, item_id, item_name, quantity, notes, transaction_type, transaction_date, created_by, user_id) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, name, contact_person, email, phone, address, group_name, notes, created_at, updated_at, role_id) FROM stdin;
2	europlac	Marian Kucerka	m.kucerka@europlac.com	341	TOPOLCANY	Team Leaders	LEADER H1	2025-05-16 13:14:39.405553+02	2025-05-16 13:32:37.268903+02	1
1	europlac	Frantisek Blaska	f.blaska@europlac.com	329	BOJNA	Team Leaders	LEADER H7	2025-05-11 01:25:48.561539+02	2025-05-16 13:44:27.950453+02	1
\.


--
-- Data for Name: db_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.db_migrations (id, name, applied_at) FROM stdin;
1	001_add_performance_indexes.js	2025-05-15 15:37:36.268169+02
2	002_create_customer_transactions_table.js	2025-05-15 15:37:36.282487+02
3	003_create_item_transactions_table.js	2025-05-15 15:37:36.310816+02
4	add-soft-delete-to-items.js	2025-05-16 10:10:02.691583+02
\.


--
-- Data for Name: groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.groups (id, name, description, created_at, updated_at) FROM stdin;
2	Workers		2025-05-12 14:56:42.964245+02	2025-05-12 14:56:42.964245+02
3	Head Workers		2025-05-12 14:57:03.258008+02	2025-05-12 14:57:03.258008+02
1	Team Leaders		2025-05-12 13:35:58.104072+02	2025-05-12 14:57:11.613424+02
4	Office Stuff		2025-05-12 14:57:38.708146+02	2025-05-12 14:57:38.708146+02
5	Manager		2025-05-12 14:58:06.867747+02	2025-05-12 14:58:06.867747+02
\.


--
-- Data for Name: item_properties; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.item_properties (id, item_id, type, ean_code, serial_number, additional_data, created_at, updated_at) FROM stdin;
4	2	Accessory	9876543210987	SN67890	{}	2025-05-15 08:58:54.146529+02	2025-05-15 08:58:54.146529+02
9	11				{}	2025-05-15 15:11:34.780134+02	2025-05-15 15:11:34.780134+02
5	6	CABLE	EPL-IT-STOCK-6-1WXK	123456	{}	2025-05-15 10:24:22.51079+02	2025-05-16 15:47:41.53974+02
14	5	CABLE	EPL-IT-STOCK-5-9EIU	123456	{}	2025-05-16 13:39:31.791247+02	2025-05-16 15:47:59.881616+02
8	10	\N	8595574413025	\N	{}	2025-05-15 14:06:19.444739+02	2025-05-16 16:42:53.499962+02
11	12	\N	EPL-IT-STOCK-12-LYQL	\N	{}	2025-05-15 16:06:47.106208+02	2025-05-16 16:42:53.499962+02
13	17	\N	EPL-IT-STOCK-17-Y1XW	\N	{}	2025-05-16 09:18:00.5778+02	2025-05-16 16:42:53.499962+02
12	16	INK	EPL-IT-STOCK-16-OT1G	\N	{}	2025-05-15 16:06:47.171059+02	2025-05-16 16:42:53.499962+02
6	15	INK	EPL-IT-STOCK-15-56NO	\N	{}	2025-05-15 11:06:06.726881+02	2025-05-16 16:42:53.499962+02
16	14	INK	\N	\N	{}	2025-05-16 16:03:22.048097+02	2025-05-16 16:42:53.499962+02
7	3	\N	EPL-IT-STOCK-3-XRAW	\N	{}	2025-05-15 11:24:24.922974+02	2025-05-16 16:42:53.499962+02
17	4	\N	EPL-IT-STOCK-4-JWO4	\N	{}	2025-05-16 16:13:50.094333+02	2025-05-16 16:42:53.499962+02
10	8	cable	\N	\N	{}	2025-05-15 15:55:59.735435+02	2025-05-16 16:42:53.499962+02
15	7	cable	EPL-IT-STOCK-7-VE0R	\N	{}	2025-05-16 15:34:18.693604+02	2025-05-16 16:42:53.499962+02
18	18	TONER	EPL-IT-STOCK-18-VYQM	123456	{}	2025-05-16 16:26:12.071555+02	2025-05-18 14:18:05.068961+02
\.


--
-- Data for Name: item_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.item_transactions (id, item_id, item_name, transaction_type, quantity, previous_quantity, new_quantity, box_id, previous_box_id, new_box_id, related_item_id, related_item_name, customer_id, supplier, notes, created_by, user_id, created_at, metadata, details) FROM stdin;
6	2	Test Item 2	STOCK_IN	5	0	5	2	\N	\N	\N	\N	\N	\N	Initial stock	system	\N	2023-01-02 13:00:00+01	\N	\N
8	6	DVI 5m	STOCK_OUT	1	2	1	3	\N	\N	\N	\N	1	\N	\N	Milan	1	2025-05-15 14:06:41.058935+02	\N	\N
9	10	285A	STOCK_OUT	1	5	4	6	\N	\N	\N	\N	1	\N	\N	Milan	1	2025-05-15 14:42:33.567955+02	\N	\N
10	10	285A	STOCK_OUT	1	4	3	6	\N	\N	\N	\N	1	\N	\N	Milan	1	2025-05-15 14:49:36.092513+02	\N	\N
11	10	285A	STOCK_OUT	1	3	2	6	\N	\N	\N	\N	1	\N	Removed due to: CONSUMED	Milan	1	2025-05-15 15:21:19.858232+02	\N	\N
12	10	285A	STOCK_OUT	1	2	1	6	\N	\N	\N	\N	1	\N	Removed due to: CONSUMED	Milan	1	2025-05-15 15:54:31.069341+02	\N	\N
13	8	hdmi 2m	STOCK_OUT	1	7	6	3	\N	\N	\N	\N	1	\N	Removed due to: CONSUMED	Milan	1	2025-05-15 15:55:59.664967+02	\N	\N
14	4	HDMI 1.5m	DELETE	5	\N	\N	3	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 10:20:41.422+02	\N	Item deleted from inventory
15	10	285A	STOCK_IN	2	1	3	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 11:00:41.502+02	\N	Stock added to inventory
16	10	285A	STOCK_OUT	1	3	2	6	\N	\N	\N	\N	1	\N	\N	Milan	\N	2025-05-16 12:46:25.998+02	\N	Removed due to: 1
17	10	285A	TRANSFER	2	2	2	3	6	3	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 14:37:48.992+02	\N	presun
18	14	EPSON 112 YELLOW	TRANSFER	3	3	3	5	6	5	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 14:38:52.131+02	\N	Item transferred from Box 6 to Box 5
19	10	285A	TRANSFER	2	2	2	1	3	1	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 14:41:29.076+02	\N	Item transferred from Box 3 to Box 1
20	17	CRG052	STOCK_IN	2	10	12	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 14:42:24.787+02	\N	Stock added to inventory
22	12	EPSON 112 CYAN	TRANSFER	3	3	3	1	6	1	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 15:09:53.53+02	\N	Item transferred from Box 6 to Box 1
23	17	CRG052	ITEM_UPDATED	12	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 15:27:12.008+02	\N	Item details updated
24	17	CRG052	ITEM_UPDATED	12	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 15:27:42.86+02	\N	Item details updated
25	6	DVI 5m	ITEM_UPDATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 15:32:31.631+02	\N	Item details updated
26	7	HDMI 5m	ITEM_UPDATED	15	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 15:34:11.743+02	\N	Item details updated
27	6	DVI 5m	ITEM_UPDATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 15:37:24.65+02	\N	Item details updated
28	6	DVI 5m	ITEM_UPDATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 15:43:43.097+02	\N	Item details updated
29	6	DVI 5m	ITEM_UPDATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 15:47:34.58+02	\N	Item details updated
30	5	DVI cables 	ITEM_UPDATED	3	\N	\N	5	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 15:47:53.171+02	\N	Item details updated
31	16	EPSON 112 MAGENTA	ITEM_UPDATED	3	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 15:58:15.975+02	\N	Item details updated
32	16	EPSON 112 MAGENTA	ITEM_UPDATED	3	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 15:59:25.308+02	\N	Item details updated
33	15	EPSON 112 BLACK	ITEM_UPDATED	3	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:00:12.044+02	\N	Item details updated
34	14	EPSON 112 YELLOW	ITEM_UPDATED	3	\N	\N	5	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:03:15.08+02	\N	Item details updated
35	14	EPSON 112 YELLOW	ITEM_UPDATED	3	\N	\N	5	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:03:46.927+02	\N	Item details updated
36	3	SAMSUNG SSD 1TB	ITEM_UPDATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:06:05.902+02	\N	Item details updated
37	4	HDMI 1.5m	ITEM_UPDATED	5	\N	\N	3	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:13:43.104+02	\N	Item details updated
38	8	hdmi 2m	ITEM_UPDATED	6	\N	\N	3	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:24:16.878+02	\N	Item details updated
39	18	283	ITEM_CREATED	5	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:26:05.076+02	\N	Item created
40	18	283	NEW_ITEM	5	0	5	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:26:05.078+02	\N	Initial item stock
41	7	HDMI 5m	ITEM_UPDATED	15	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:31:19.618+02	\N	Item details updated
42	7	HDMI 5m	ITEM_UPDATED	15	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:32:01.665+02	\N	Item details updated
43	7	HDMI 5m	ITEM_UPDATED	15	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:32:06.21+02	\N	Item details updated
44	18	283	ITEM_UPDATED	5	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:36:00.254+02	\N	Item details updated
45	18	283	ITEM_UPDATED	5	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:37:40.098+02	\N	Item details updated
50	18	283	ITEM_UPDATED	5	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:48:54.524+02	\N	Item details updated
51	18	283	ITEM_UPDATED	5	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-17 21:12:00.058+02	\N	Item details updated
52	18	283	ITEM_UPDATED	5	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-17 21:24:48.012+02	\N	Item details updated
46	\N	200	ITEM_CREATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:41:30.215+02	\N	Item created
47	\N	200	NEW_ITEM	1	0	1	6	\N	\N	\N	\N	\N	ALZA	\N	Milan	\N	2025-05-16 16:41:30.216+02	\N	toner
53	\N	200	SOFT_DELETE	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 13:49:07.513+02	\N	Item soft-deleted (moved to trash)
55	\N	200	ITEM_UPDATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 13:49:39.353+02	\N	Item details updated
56	\N	200	ITEM_UPDATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 13:59:58.238+02	\N	Item details updated
61	\N	200	ITEM_UPDATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:10:45.302+02	\N	Item details updated
62	\N	200	ITEM_UPDATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:13:40.268+02	\N	Item details updated
48	\N	200	ITEM_CREATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 16:45:53.229+02	\N	Item created
49	\N	200	NEW_ITEM	1	0	1	6	\N	\N	\N	\N	\N	ALZA	\N	Milan	\N	2025-05-16 16:45:53.23+02	\N	Initial stock from supplier: ALZA
54	\N	200	ITEM_UPDATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 13:49:26.741+02	\N	Item details updated
64	\N	200	SOFT_DELETE	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:15:54.084+02	\N	Item soft-deleted (moved to trash)
57	\N	201	ITEM_CREATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:00:08.559+02	\N	Item created
58	\N	201	NEW_ITEM	1	0	1	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:00:08.559+02	\N	Initial item stock
59	\N	201	NEW_ITEM	1	0	1	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:00:50.407+02	\N	Initial item stock
60	\N	201	ITEM_CREATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:00:50.407+02	\N	Item created
5	\N	Test Item 1	STOCK_IN	10	0	10	1	\N	\N	\N	\N	\N	\N	Initial stock	system	\N	2023-01-01 13:00:00+01	\N	\N
7	\N	Test Item 1	STOCK_OUT	2	10	8	1	\N	\N	\N	\N	\N	\N	Stock removed from inventory	system	\N	2023-01-03 13:00:00+01	\N	\N
21	\N	Test Item 1	SOFT_DELETE	0	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-16 15:01:46.129+02	\N	Item soft-deleted (moved to trash)
63	\N	200	ITEM_UPDATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:15:38.691+02	\N	Item details updated
65	\N	200	SOFT_DELETE	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:15:56.53+02	\N	Item soft-deleted (moved to trash)
68	18	283	ITEM_UPDATED	5	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:17:53.107+02	\N	Item details updated
69	18	283	ITEM_UPDATED	5	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:18:05.284+02	\N	Item details updated
70	\N	202	ITEM_UPDATED	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:23:49.959+02	\N	Item details updated
72	\N	202	SOFT_DELETE	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:24:29.143+02	\N	Item soft-deleted (moved to trash)
73	\N	202	PERMANENT_DELETE	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:24:39.385+02	\N	Item permanently deleted from system
71	\N	201	SOFT_DELETE	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:24:24.007+02	\N	Item soft-deleted (moved to trash)
74	\N	201	PERMANENT_DELETE	1	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:24:41.333+02	\N	Item permanently deleted from system
75	\N	Test Item 1	PERMANENT_DELETE	0	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Milan	\N	2025-05-18 14:24:43.436+02	\N	Item permanently deleted from system
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.items (id, name, description, quantity, box_id, created_at, updated_at, supplier, parent_item_id, type, ean_code, serial_number, qr_code, deleted_at) FROM stdin;
6	DVI 5m	PC KABEL	1	6	2025-05-11 00:25:16.952055+02	2025-05-16 15:47:41.545602+02	ALZA	\N	CABLE	EPL-IT-STOCK-6-1WXK	123456	\N	\N
5	DVI cables 	\N	3	5	2025-05-11 00:25:01.30191+02	2025-05-16 15:47:59.970018+02	DAMEDIS	\N	CABLE	EPL-IT-STOCK-5-9EIU	123456	\N	\N
11	DATALOGIC QW2120	\N	2	\N	2025-05-13 07:57:30.38592+02	2025-05-15 15:11:34.791383+02	DATALOGIC	\N				\N	\N
24	Test Item 2025-05-18T12:10:04.782Z	Created during view fix test	5	1	2025-05-18 14:10:04.790714+02	2025-05-18 14:10:04.790714+02	\N	\N	\N	\N	\N	\N	\N
10	285A	\N	2	1	2025-05-12 16:10:47.063226+02	2025-05-16 16:42:53.499962+02	DAMEDIS	\N	\N	8595574413025	\N	\N	\N
12	EPSON 112 CYAN	\N	3	1	2025-05-14 14:09:52.292752+02	2025-05-16 16:42:53.499962+02	\N	\N	\N	EPL-IT-STOCK-12-LYQL	\N	\N	\N
17	CRG052	\N	12	6	2025-05-16 09:18:00.485431+02	2025-05-16 16:42:53.499962+02	DAMEDIS	\N	\N	EPL-IT-STOCK-17-Y1XW	\N	\N	\N
16	EPSON 112 MAGENTA	RUZOVY	3	6	2025-05-14 14:12:08.288368+02	2025-05-16 16:42:53.499962+02	DAMEDIS	\N	INK	EPL-IT-STOCK-16-OT1G	\N	\N	\N
15	EPSON 112 BLACK	\N	3	6	2025-05-14 14:11:43.109334+02	2025-05-16 16:42:53.499962+02	DAMEDIS	\N	INK	EPL-IT-STOCK-15-56NO	\N	\N	\N
14	EPSON 112 YELLOW	ATRAMENT	3	5	2025-05-14 14:11:13.749643+02	2025-05-16 16:42:53.499962+02	DAMEDIS	\N	INK	\N	\N	\N	\N
3	SAMSUNG SSD 1TB	\N	1	6	2025-05-08 14:30:10.153849+02	2025-05-16 16:42:53.499962+02	ALZA	\N	\N	EPL-IT-STOCK-3-XRAW	\N	\N	\N
4	HDMI 1.5m	\N	5	3	2025-05-11 00:09:33.89983+02	2025-05-16 16:42:53.499962+02	\N	\N	\N	EPL-IT-STOCK-4-JWO4	\N	EPL-IT-STOCK-4-JWO4	\N
8	hdmi 2m	\N	6	3	2025-05-11 01:10:27.546846+02	2025-05-16 16:42:53.499962+02	ALZA	\N	cable	\N	\N	\N	\N
7	HDMI 5m	golden 	15	6	2025-05-11 00:50:03.815554+02	2025-05-16 16:42:53.499962+02	\N	17	cable	EPL-IT-STOCK-7-VE0R	\N	\N	\N
18	283	\N	5	6	2025-05-16 16:26:12.006209+02	2025-05-18 14:18:05.068961+02	DAMEDIS	\N	TONER	EPL-IT-STOCK-18-VYQM	123456	\N	\N
2	HDMI cables	\N	10	3	2025-05-08 12:41:20.342188+02	2025-05-18 14:24:43.365693+02	\N	\N	Accessory	9876543210987	SN67890	\N	\N
\.


--
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.locations (id, name, description, color, created_at, updated_at) FROM stdin;
4	FINANCIAL STOCK	Financial department storage	#f5d866	2025-05-08 23:13:35.100064+02	2025-05-08 23:30:13.989608+02
2	IT HOUSE	External IT storage facility	#66f4b7	2025-05-08 23:13:35.100064+02	2025-05-08 23:30:22.295324+02
1	IT OFFICE	IT department main office	#6ea2f7	2025-05-08 23:13:35.100064+02	2025-05-08 23:30:28.67043+02
3	SERVER ROOM	Main server room	#f96c6c	2025-05-08 23:13:35.100064+02	2025-05-08 23:30:34.933172+02
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.migrations (id, name, applied_at) FROM stdin;
1	01_add_unique_box_reference.sql	2025-05-14 10:15:30.837628+02
2	02_add_reference_id_to_boxes.sql	2025-05-14 10:15:31.03914+02
3	add_item_id_to_transactions.sql	2025-05-15 08:40:27.113786+02
4	add_item_properties_table.sql	2025-05-15 08:40:27.128823+02
5	add_parent_item_id_to_items.sql	2025-05-15 08:40:27.28491+02
6	add_supplier_to_items.sql	2025-05-15 08:40:27.300376+02
7	add_transaction_history_table.sql	2025-05-15 08:40:27.317416+02
8	create_admin_panel_tables.sql	2025-05-15 08:40:27.414744+02
9	create_customers_groups_tables.sql	2025-05-15 08:40:27.418374+02
10	create_users_table.sql	2025-05-15 08:41:39.675819+02
11	update_boxes_created_by.sql	2025-05-15 08:41:39.687924+02
12	00_create_updated_at_function.sql	2025-05-15 08:42:20.141594+02
13	create_roles_table.sql	2025-05-15 08:42:20.171729+02
14	update_customers_tables.sql	2025-05-15 08:42:20.327438+02
15	add_qr_code_to_items.sql	2025-05-15 09:57:32.904772+02
\.


--
-- Data for Name: removal_reasons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.removal_reasons (id, name, description, created_at, updated_at) FROM stdin;
1	CONSUMED	Item was consumed or used up	2025-05-16 09:02:24.018548	2025-05-16 09:02:24.018548
2	DAMAGED	Item was damaged and cannot be used	2025-05-16 09:02:24.023041	2025-05-16 09:02:24.023041
3	EXPIRED	Item has expired	2025-05-16 09:02:24.025821	2025-05-16 09:02:24.025821
5	RETURNED	Item was returned to supplier	2025-05-16 09:02:24.031798	2025-05-16 09:02:24.031798
6	LOST	Item was lost	2025-05-16 09:02:24.035411	2025-05-16 09:02:24.035411
7	OTHER	Other reason	2025-05-16 09:02:24.038977	2025-05-16 09:02:24.038977
4	SOLD	Item was sold to a customer	2025-05-16 09:02:24.028302	2025-05-16 15:03:27.249359
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, description, color, created_at, updated_at) FROM stdin;
1	Customer	Regular customer	#0d6efd	2025-05-15 08:42:20.171729+02	2025-05-15 08:42:20.171729+02
2	VIP	Very important customer	#dc3545	2025-05-15 08:42:20.171729+02	2025-05-15 08:42:20.171729+02
3	Partner	Business partner	#198754	2025-05-15 08:42:20.171729+02	2025-05-15 08:42:20.171729+02
4	Supplier	Product supplier	#fd7e14	2025-05-15 08:42:20.171729+02	2025-05-15 08:42:20.171729+02
5	Internal	Internal department	#6f42c1	2025-05-15 08:42:20.171729+02	2025-05-15 08:42:20.171729+02
\.


--
-- Data for Name: shelves; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shelves (id, name, location_id, color_id, description, created_at, updated_at) FROM stdin;
1	A1	1	8		2025-05-08 23:25:32.360378+02	2025-05-08 23:25:32.360378+02
2	IT HOUSE	2	2		2025-05-11 01:38:08.424359+02	2025-05-11 01:38:08.424359+02
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, box_id, transaction_type, notes, created_by, created_at, item_id, user_id) FROM stdin;
1	1	CREATE	Initial box creation	admin	2025-05-08 12:38:20.424696+02	\N	\N
2	2	CREATE	Initial box creation	admin	2025-05-08 12:51:34.605071+02	\N	\N
3	1	TRANSFER_OUT	lebo preto	system	2025-05-08 13:18:10.563928+02	2	\N
4	2	TRANSFER_IN	lebo preto	system	2025-05-08 13:18:10.563928+02	2	\N
5	3	CREATE	Initial box creation	Milan	2025-05-08 14:09:09.282285+02	\N	1
6	2	TRANSFER_OUT	Item 'HDMI cables' transferred out	Milan	2025-05-08 14:16:05.727783+02	2	1
7	3	TRANSFER_IN	Item 'HDMI cables' transferred in	Milan	2025-05-08 14:16:05.727783+02	2	1
8	4	CREATE	Initial box creation	Milan	2025-05-08 14:32:45.339631+02	\N	1
9	1	UPDATE	Box details updated	Milan	2025-05-08 23:26:06.58451+02	\N	1
10	2	UPDATE	Box details updated	Milan	2025-05-08 23:26:19.026647+02	\N	1
11	1	ADD_ITEM	Item 'HDMI 5m' added to box	Milan	2025-05-11 00:50:03.815554+02	7	1
12	1	ADD_ITEM	Item 'hdmi 2m' added to box	Milan	2025-05-11 01:10:27.546846+02	8	1
13	1	REMOVE_ITEM	Item 'hdmi cables' removed from box	Milan	2025-05-11 01:10:35.159577+02	\N	1
14	2	UPDATE	Box details updated	Milan	2025-05-11 01:38:39.877972+02	\N	1
15	3	UPDATE	Box details updated	Milan	2025-05-12 14:03:44.441499+02	\N	1
16	4	UPDATE	Box details updated	Milan	2025-05-12 14:03:58.32576+02	\N	1
18	4	ADD_ITEM	Item 'CE285A' added to box	Milan	2025-05-12 16:10:47.063226+02	10	1
19	5	CREATE	Initial box creation	Milan	2025-05-14 09:14:10.767082+02	\N	1
20	1	REMOVE_ITEM	Item 'Printline CE285' removed from box	Milan	2025-05-14 10:56:41.745105+02	\N	1
17	1	ADD_ITEM	Item 'Printline CE285' added to box	Milan	2025-05-12 14:49:42.707276+02	\N	1
21	1	ADD_ITEM	Item '285A' added to box	Milan	2025-05-14 10:56:53.185676+02	10	1
22	5	UPDATE	Box information updated	Milan	2025-05-14 11:51:17.903106+02	\N	1
23	6	CREATE	Initial box creation	Milan	2025-05-14 11:52:24.186171+02	\N	1
24	1	TRANSFER_OUT	Item '285A' transferred out	Milan	2025-05-14 12:57:01.044317+02	10	1
25	6	TRANSFER_IN	Item '285A' transferred in	Milan	2025-05-14 12:57:01.044317+02	10	1
26	6	ADD_ITEM	Item 'EPSON 112 CYAN' added to box	Milan	2025-05-14 14:09:52.292752+02	12	1
28	6	REMOVE_ITEM	Item 'EPSON 112 CYAN' removed from box	Milan	2025-05-14 14:10:21.100666+02	\N	1
27	6	ADD_ITEM	Item 'EPSON 112 CYAN' added to box	Milan	2025-05-14 14:10:10.289611+02	\N	1
29	6	ADD_ITEM	Item 'EPSON 112 YELLOW' added to box	Milan	2025-05-14 14:11:13.749643+02	14	1
30	6	ADD_ITEM	Item 'EPSON 112 BLACK' added to box	Milan	2025-05-14 14:11:43.109334+02	15	1
31	6	ADD_ITEM	Item 'EPSON 112 MAGENTA' added to box	Milan	2025-05-14 14:12:08.288368+02	16	1
32	6	UPDATE	Box information updated	Milan	2025-05-14 14:13:14.880892+02	\N	1
33	3	ADD_ITEM	Item 'DVI 5m' added to box	Milan	2025-05-14 14:40:26.447585+02	6	1
34	3	ADD_ITEM	Item 'HDMI 1.5m' added to box	Milan	2025-05-14 14:40:59.340608+02	4	1
35	1	REMOVE_ITEM	Item 'hdmi 2m' removed from box	Milan	2025-05-14 14:41:10.798592+02	8	1
36	3	ADD_ITEM	Item 'hdmi 2m' added to box	Milan	2025-05-14 14:41:10.798592+02	8	1
37	1	REMOVE_ITEM	Item 'HDMI 5m' removed from box	Milan	2025-05-14 14:41:20.687512+02	7	1
38	3	ADD_ITEM	Item 'HDMI 5m' added to box	Milan	2025-05-14 14:41:20.687512+02	7	1
39	6	UPDATE	Box information updated	Milan	2025-05-14 15:40:29.499277+02	\N	1
40	6	UPDATE	Box information updated	Milan	2025-05-14 15:42:20.255568+02	\N	1
41	6	REMOVE_ITEM	Item 'EPSON 112 CYAN' removed from box	Milan	2025-05-15 16:06:47.015942+02	12	1
42	6	REMOVE_ITEM	Item 'EPSON 112 MAGENTA' removed from box	Milan	2025-05-15 16:06:47.105294+02	16	1
43	6	ADD_ITEM	Item 'CRG052' added to box	Milan	2025-05-16 09:18:00.485431+02	17	1
44	6	REMOVE_ITEM	Item 'EPSON 112 BLACK' removed from box	Milan	2025-05-16 11:10:07.671356+02	15	1
45	3	REMOVE_ITEM	Item 'DVI 5m' removed from box	Milan	2025-05-16 13:39:31.619708+02	6	1
46	6	TRANSFER_OUT	presun	Milan	2025-05-16 14:37:55.970845+02	10	1
47	3	TRANSFER_IN	presun	Milan	2025-05-16 14:37:55.970845+02	10	1
48	6	TRANSFER_OUT	Item 'EPSON 112 YELLOW' transferred out	Milan	2025-05-16 14:38:59.109568+02	14	1
49	5	TRANSFER_IN	Item 'EPSON 112 YELLOW' transferred in	Milan	2025-05-16 14:38:59.109568+02	14	1
50	3	TRANSFER_OUT	Item '285A' transferred out	Milan	2025-05-16 14:41:36.024841+02	10	1
51	1	TRANSFER_IN	Item '285A' transferred in	Milan	2025-05-16 14:41:36.024841+02	10	1
52	6	ADD_ITEM	Item 'EPSON 112 BLACK' added to box	Milan	2025-05-16 14:50:46.589247+02	15	1
53	6	ADD_ITEM	Item 'EPSON 112 CYAN' added to box	Milan	2025-05-16 15:09:39.380758+02	12	1
54	6	TRANSFER_OUT	Item 'EPSON 112 CYAN' transferred out	Milan	2025-05-16 15:10:00.533087+02	12	1
55	1	TRANSFER_IN	Item 'EPSON 112 CYAN' transferred in	Milan	2025-05-16 15:10:00.533087+02	12	1
56	6	ADD_ITEM	Item 'DVI 5m' added to box	Milan	2025-05-16 15:32:38.458902+02	6	1
57	3	REMOVE_ITEM	Item 'HDMI 5m' removed from box	Milan	2025-05-16 15:34:18.586812+02	7	1
58	6	ADD_ITEM	Item 'HDMI 5m' added to box	Milan	2025-05-16 15:34:18.586812+02	7	1
59	5	ADD_ITEM	Item 'DVI cables ' added to box	Milan	2025-05-16 15:47:59.805691+02	5	1
60	6	ADD_ITEM	Item 'EPSON 112 MAGENTA' added to box	Milan	2025-05-16 15:58:22.74054+02	16	1
61	6	ADD_ITEM	Item 'SAMSUNG SSD 1TB' added to box	Milan	2025-05-16 16:06:12.71741+02	3	1
62	6	ADD_ITEM	Item '283' added to box	Milan	2025-05-16 16:26:12.006209+02	18	1
63	6	ADD_ITEM	Item '200' added to box	Milan	2025-05-16 16:41:37.132071+02	\N	1
64	6	ADD_ITEM	Item '200' added to box	Milan	2025-05-16 16:46:00.141859+02	\N	1
65	6	ADD_ITEM	New item '201' added to box	Milan	2025-05-18 14:00:08.311177+02	\N	1
66	6	ADD_ITEM	New item '201' added to box	Milan	2025-05-18 14:00:50.125045+02	\N	1
\.


--
-- Data for Name: user_groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_groups (id, user_id, group_id, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password, email, full_name, role, created_at, updated_at) FROM stdin;
1	Milan	$2b$10$Md72N0fre7KEHn9YekLq9ee4GgCYGCQGAQ3bhRf2jzxfR/uGAcM3i	m.barat@europlac.com	Milan Barat	admin	2025-05-08 13:33:04.415175+02	2025-05-08 14:03:40.016269+02
2	admin	$2b$10$G6XtSq5vTaP.PkF7Q69aDehljI2yTpesX89.lMzXDzbfVvwIdt2qO	admin@europlac.com	admin admin	admin	2025-05-08 14:04:03.375058+02	2025-05-08 14:04:03.375058+02
6	ITSTOCK	$2b$10$0uKQYCMZiKLTBwoAlKB7yeJlKRXSP4hOf6fFo836rbFmtG6s1GC0K	\N	ITSTOCK OFFICE	admin	2025-05-16 09:37:51.824361+02	2025-05-16 09:37:51.824361+02
\.


--
-- Data for Name: boxes; Type: TABLE DATA; Schema: test_schema; Owner: postgres
--

COPY test_schema.boxes (id, box_number, description, location_id, shelf_id, created_at) FROM stdin;
1	TEST123	Test Box for New Schema	1	1	2025-05-18 13:59:12.828304+02
\.


--
-- Data for Name: item_audit_log; Type: TABLE DATA; Schema: test_schema; Owner: postgres
--

COPY test_schema.item_audit_log (id, item_id, user_id, action, changed_fields, old_values, new_values, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: item_images; Type: TABLE DATA; Schema: test_schema; Owner: postgres
--

COPY test_schema.item_images (id, item_id, image_url, is_primary, created_at) FROM stdin;
\.


--
-- Data for Name: item_properties; Type: TABLE DATA; Schema: test_schema; Owner: postgres
--

COPY test_schema.item_properties (id, item_id, type, ean_code, serial_number, qr_code, supplier, purchase_date, expiry_date, warranty_expiry, cost, additional_data, created_at, updated_at) FROM stdin;
1	1	Electronics	1234567890123	LAPTOP123456	\N	\N	\N	\N	\N	\N	{}	2025-05-18 13:59:12.843253+02	2025-05-18 13:59:12.843253+02
2	2	Electronics	3210987654321	MONITOR654321	\N	\N	\N	\N	\N	\N	{}	2025-05-18 13:59:12.85127+02	2025-05-18 13:59:12.85127+02
3	3	Accessories	4567890123456	KB987654	\N	\N	\N	\N	\N	\N	{}	2025-05-18 13:59:12.8585+02	2025-05-18 13:59:12.8585+02
\.


--
-- Data for Name: item_tag_relations; Type: TABLE DATA; Schema: test_schema; Owner: postgres
--

COPY test_schema.item_tag_relations (item_id, tag_id) FROM stdin;
1	1
1	2
1	3
\.


--
-- Data for Name: item_tags; Type: TABLE DATA; Schema: test_schema; Owner: postgres
--

COPY test_schema.item_tags (id, name, color, created_at) FROM stdin;
1	Test	#ff0000	2025-05-18 13:59:12.966656+02
2	Electronics	#00ff00	2025-05-18 13:59:12.966656+02
3	Important	#0000ff	2025-05-18 13:59:12.966656+02
\.


--
-- Data for Name: item_transactions; Type: TABLE DATA; Schema: test_schema; Owner: postgres
--

COPY test_schema.item_transactions (id, item_id, type, quantity, box_id, previous_box_id, user_id, customer_id, notes, supplier, reference_code, transaction_date, created_at) FROM stdin;
1	1	in	10	1	\N	\N	\N	Testing stock in transaction	Test Supplier	\N	2025-05-18 13:59:12.937381+02	2025-05-18 13:59:12.937381+02
2	1	out	3	1	\N	\N	\N	Testing stock out transaction	\N	\N	2025-05-18 13:59:12.944584+02	2025-05-18 13:59:12.944584+02
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: test_schema; Owner: postgres
--

COPY test_schema.items (id, name, description, quantity, box_id, parent_item_id, status, created_at, updated_at, deleted_at) FROM stdin;
2	Test Monitor	Testing monitor for new schema	3	1	\N	active	2025-05-18 13:59:12.847561+02	2025-05-18 13:59:12.847561+02	\N
3	Test Keyboard	Testing keyboard for new schema	10	1	\N	active	2025-05-18 13:59:12.854801+02	2025-05-18 13:59:12.854801+02	\N
1	Test Laptop (Updated)	Testing item for new schema	5	1	\N	active	2025-05-18 13:59:12.835857+02	2025-05-18 13:59:12.958231+02	\N
\.


--
-- Data for Name: locations; Type: TABLE DATA; Schema: test_schema; Owner: postgres
--

COPY test_schema.locations (id, name, color) FROM stdin;
1	Test Location	#ff5722
\.


--
-- Data for Name: shelves; Type: TABLE DATA; Schema: test_schema; Owner: postgres
--

COPY test_schema.shelves (id, name) FROM stdin;
1	Test Shelf
\.


--
-- Data for Name: transaction_metadata; Type: TABLE DATA; Schema: test_schema; Owner: postgres
--

COPY test_schema.transaction_metadata (transaction_id, reason_id, invoice_number, external_reference, approved_by, data) FROM stdin;
1	\N	INV-001	PO-12345	\N	{}
\.


--
-- Name: boxes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.boxes_id_seq', 6, true);


--
-- Name: colors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.colors_id_seq', 18, true);


--
-- Name: customer_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_transactions_id_seq', 1, false);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 2, true);


--
-- Name: db_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.db_migrations_id_seq', 4, true);


--
-- Name: groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.groups_id_seq', 5, true);


--
-- Name: item_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.item_properties_id_seq', 22, true);


--
-- Name: item_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.item_transactions_id_seq', 75, true);


--
-- Name: items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.items_id_seq', 24, true);


--
-- Name: locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.locations_id_seq', 8, true);


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.migrations_id_seq', 15, true);


--
-- Name: removal_reasons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.removal_reasons_id_seq', 7, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roles_id_seq', 5, true);


--
-- Name: shelves_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shelves_id_seq', 2, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transactions_id_seq', 66, true);


--
-- Name: user_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_groups_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 6, true);


--
-- Name: boxes_id_seq; Type: SEQUENCE SET; Schema: test_schema; Owner: postgres
--

SELECT pg_catalog.setval('test_schema.boxes_id_seq', 1, true);


--
-- Name: item_audit_log_id_seq; Type: SEQUENCE SET; Schema: test_schema; Owner: postgres
--

SELECT pg_catalog.setval('test_schema.item_audit_log_id_seq', 1, false);


--
-- Name: item_images_id_seq; Type: SEQUENCE SET; Schema: test_schema; Owner: postgres
--

SELECT pg_catalog.setval('test_schema.item_images_id_seq', 1, false);


--
-- Name: item_properties_id_seq; Type: SEQUENCE SET; Schema: test_schema; Owner: postgres
--

SELECT pg_catalog.setval('test_schema.item_properties_id_seq', 3, true);


--
-- Name: item_tags_id_seq; Type: SEQUENCE SET; Schema: test_schema; Owner: postgres
--

SELECT pg_catalog.setval('test_schema.item_tags_id_seq', 3, true);


--
-- Name: item_transactions_id_seq; Type: SEQUENCE SET; Schema: test_schema; Owner: postgres
--

SELECT pg_catalog.setval('test_schema.item_transactions_id_seq', 2, true);


--
-- Name: items_id_seq; Type: SEQUENCE SET; Schema: test_schema; Owner: postgres
--

SELECT pg_catalog.setval('test_schema.items_id_seq', 3, true);


--
-- Name: locations_id_seq; Type: SEQUENCE SET; Schema: test_schema; Owner: postgres
--

SELECT pg_catalog.setval('test_schema.locations_id_seq', 1, true);


--
-- Name: shelves_id_seq; Type: SEQUENCE SET; Schema: test_schema; Owner: postgres
--

SELECT pg_catalog.setval('test_schema.shelves_id_seq', 1, true);


--
-- Name: boxes boxes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boxes
    ADD CONSTRAINT boxes_pkey PRIMARY KEY (id);


--
-- Name: colors colors_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.colors
    ADD CONSTRAINT colors_name_key UNIQUE (name);


--
-- Name: colors colors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.colors
    ADD CONSTRAINT colors_pkey PRIMARY KEY (id);


--
-- Name: customer_transactions customer_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_transactions
    ADD CONSTRAINT customer_transactions_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: db_migrations db_migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.db_migrations
    ADD CONSTRAINT db_migrations_name_key UNIQUE (name);


--
-- Name: db_migrations db_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.db_migrations
    ADD CONSTRAINT db_migrations_pkey PRIMARY KEY (id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: item_properties item_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_properties
    ADD CONSTRAINT item_properties_pkey PRIMARY KEY (id);


--
-- Name: item_transactions item_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: locations locations_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_name_key UNIQUE (name);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: removal_reasons removal_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.removal_reasons
    ADD CONSTRAINT removal_reasons_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: shelves shelves_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shelves
    ADD CONSTRAINT shelves_name_key UNIQUE (name);


--
-- Name: shelves shelves_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shelves
    ADD CONSTRAINT shelves_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: boxes unique_box_reference; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boxes
    ADD CONSTRAINT unique_box_reference UNIQUE (reference_uuid);


--
-- Name: user_groups user_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_pkey PRIMARY KEY (id);


--
-- Name: user_groups user_groups_user_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_user_id_group_id_key UNIQUE (user_id, group_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: boxes boxes_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.boxes
    ADD CONSTRAINT boxes_pkey PRIMARY KEY (id);


--
-- Name: item_audit_log item_audit_log_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_audit_log
    ADD CONSTRAINT item_audit_log_pkey PRIMARY KEY (id);


--
-- Name: item_images item_images_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_images
    ADD CONSTRAINT item_images_pkey PRIMARY KEY (id);


--
-- Name: item_properties item_properties_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_properties
    ADD CONSTRAINT item_properties_pkey PRIMARY KEY (id);


--
-- Name: item_tag_relations item_tag_relations_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_tag_relations
    ADD CONSTRAINT item_tag_relations_pkey PRIMARY KEY (item_id, tag_id);


--
-- Name: item_tags item_tags_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_tags
    ADD CONSTRAINT item_tags_pkey PRIMARY KEY (id);


--
-- Name: item_transactions item_transactions_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_transactions
    ADD CONSTRAINT item_transactions_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: shelves shelves_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.shelves
    ADD CONSTRAINT shelves_pkey PRIMARY KEY (id);


--
-- Name: transaction_metadata transaction_metadata_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.transaction_metadata
    ADD CONSTRAINT transaction_metadata_pkey PRIMARY KEY (transaction_id);


--
-- Name: idx_boxes_box_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boxes_box_number ON public.boxes USING btree (box_number);


--
-- Name: idx_boxes_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boxes_created_by ON public.boxes USING btree (created_by);


--
-- Name: idx_boxes_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boxes_deleted_at ON public.boxes USING btree (deleted_at);


--
-- Name: idx_boxes_location_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boxes_location_id ON public.boxes USING btree (location_id);


--
-- Name: idx_boxes_reference_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boxes_reference_id ON public.boxes USING btree (reference_id);


--
-- Name: idx_boxes_shelf_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boxes_shelf_id ON public.boxes USING btree (shelf_id);


--
-- Name: idx_colors_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_colors_name ON public.colors USING btree (name);


--
-- Name: idx_customer_transactions_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_transactions_customer_id ON public.customer_transactions USING btree (customer_id);


--
-- Name: idx_customer_transactions_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_transactions_item_id ON public.customer_transactions USING btree (item_id);


--
-- Name: idx_customer_transactions_transaction_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_transactions_transaction_date ON public.customer_transactions USING btree (transaction_date);


--
-- Name: idx_customer_transactions_transaction_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_transactions_transaction_type ON public.customer_transactions USING btree (transaction_type);


--
-- Name: idx_customers_group_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_group_name ON public.customers USING btree (group_name);


--
-- Name: idx_customers_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_name ON public.customers USING btree (name);


--
-- Name: idx_groups_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_groups_name ON public.groups USING btree (name);


--
-- Name: idx_item_properties_ean_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_properties_ean_code ON public.item_properties USING btree (ean_code);


--
-- Name: idx_item_properties_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_item_properties_item_id ON public.item_properties USING btree (item_id);


--
-- Name: idx_item_properties_serial_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_properties_serial_number ON public.item_properties USING btree (serial_number);


--
-- Name: idx_item_transactions_box_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_box_id ON public.item_transactions USING btree (box_id);


--
-- Name: idx_item_transactions_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_created_at ON public.item_transactions USING btree (created_at);


--
-- Name: idx_item_transactions_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_customer_id ON public.item_transactions USING btree (customer_id);


--
-- Name: idx_item_transactions_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_item_id ON public.item_transactions USING btree (item_id);


--
-- Name: idx_item_transactions_item_id_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_item_id_created_at ON public.item_transactions USING btree (item_id, created_at DESC);


--
-- Name: idx_item_transactions_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_supplier ON public.item_transactions USING btree (supplier);


--
-- Name: idx_item_transactions_transaction_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_transaction_type ON public.item_transactions USING btree (transaction_type);


--
-- Name: idx_item_transactions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_user_id ON public.item_transactions USING btree (user_id);


--
-- Name: idx_items_box_id_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_box_id_name ON public.items USING btree (box_id, name);


--
-- Name: idx_items_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_created_at ON public.items USING btree (created_at);


--
-- Name: idx_items_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_deleted_at ON public.items USING btree (deleted_at);


--
-- Name: idx_items_ean_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_ean_code ON public.items USING btree (ean_code);


--
-- Name: idx_items_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_name ON public.items USING btree (name);


--
-- Name: idx_items_parent_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_parent_item_id ON public.items USING btree (parent_item_id);


--
-- Name: idx_items_qr_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_qr_code ON public.items USING btree (qr_code);


--
-- Name: idx_items_serial_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_serial_number ON public.items USING btree (serial_number);


--
-- Name: idx_items_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_supplier ON public.items USING btree (supplier);


--
-- Name: idx_items_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_type ON public.items USING btree (type);


--
-- Name: idx_locations_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_locations_name ON public.locations USING btree (name);


--
-- Name: idx_removal_reasons_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_removal_reasons_name ON public.removal_reasons USING btree (name);


--
-- Name: idx_shelves_color_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shelves_color_id ON public.shelves USING btree (color_id);


--
-- Name: idx_shelves_location_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shelves_location_id ON public.shelves USING btree (location_id);


--
-- Name: idx_shelves_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shelves_name ON public.shelves USING btree (name);


--
-- Name: idx_transactions_box_id_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_box_id_created_at ON public.transactions USING btree (box_id, created_at DESC);


--
-- Name: idx_transactions_transaction_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_transaction_type ON public.transactions USING btree (transaction_type);


--
-- Name: idx_transactions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_user_id ON public.transactions USING btree (user_id);


--
-- Name: idx_user_groups_group_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_groups_group_id ON public.user_groups USING btree (group_id);


--
-- Name: idx_user_groups_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_groups_user_id ON public.user_groups USING btree (user_id);


--
-- Name: items_complete_view_box_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX items_complete_view_box_id_idx ON public.items_complete_view USING btree (box_id);


--
-- Name: items_complete_view_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX items_complete_view_id_idx ON public.items_complete_view USING btree (id);


--
-- Name: items_complete_view_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX items_complete_view_name_idx ON public.items_complete_view USING btree (name);


--
-- Name: items_complete_view_parent_item_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX items_complete_view_parent_item_id_idx ON public.items_complete_view USING btree (parent_item_id);


--
-- Name: idx_item_properties_ean_code; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_item_properties_ean_code ON test_schema.item_properties USING btree (ean_code);


--
-- Name: idx_item_properties_item_id; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_item_properties_item_id ON test_schema.item_properties USING btree (item_id);


--
-- Name: idx_item_properties_serial_number; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_item_properties_serial_number ON test_schema.item_properties USING btree (serial_number);


--
-- Name: idx_item_properties_supplier; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_item_properties_supplier ON test_schema.item_properties USING btree (supplier);


--
-- Name: idx_item_properties_type; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_item_properties_type ON test_schema.item_properties USING btree (type);


--
-- Name: idx_item_transactions_box_id; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_item_transactions_box_id ON test_schema.item_transactions USING btree (box_id);


--
-- Name: idx_item_transactions_customer_id; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_item_transactions_customer_id ON test_schema.item_transactions USING btree (customer_id);


--
-- Name: idx_item_transactions_item_id; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_item_transactions_item_id ON test_schema.item_transactions USING btree (item_id);


--
-- Name: idx_item_transactions_transaction_date; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_item_transactions_transaction_date ON test_schema.item_transactions USING btree (transaction_date);


--
-- Name: idx_item_transactions_type; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_item_transactions_type ON test_schema.item_transactions USING btree (type);


--
-- Name: idx_items_box_id; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_items_box_id ON test_schema.items USING btree (box_id);


--
-- Name: idx_items_description_trgm; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_items_description_trgm ON test_schema.items USING gin (description test_schema.gin_trgm_ops);


--
-- Name: idx_items_name; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_items_name ON test_schema.items USING btree (name);


--
-- Name: idx_items_name_trgm; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_items_name_trgm ON test_schema.items USING gin (name test_schema.gin_trgm_ops);


--
-- Name: idx_items_parent_item_id; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_items_parent_item_id ON test_schema.items USING btree (parent_item_id);


--
-- Name: idx_items_status; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_items_status ON test_schema.items USING btree (status);


--
-- Name: idx_items_status_deleted_at; Type: INDEX; Schema: test_schema; Owner: postgres
--

CREATE INDEX idx_items_status_deleted_at ON test_schema.items USING btree (status, deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- Name: boxes generate_box_barcode_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER generate_box_barcode_trigger BEFORE INSERT OR UPDATE ON public.boxes FOR EACH ROW EXECUTE FUNCTION public.generate_box_barcode();


--
-- Name: items refresh_items_view_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER refresh_items_view_delete AFTER DELETE ON public.items FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_items_view_func();


--
-- Name: items refresh_items_view_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER refresh_items_view_insert AFTER INSERT ON public.items FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_items_view_func();


--
-- Name: items refresh_items_view_items_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER refresh_items_view_items_trigger AFTER INSERT OR DELETE OR UPDATE ON public.items FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_items_complete_view();


--
-- Name: item_properties refresh_items_view_prop_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER refresh_items_view_prop_delete AFTER DELETE ON public.item_properties FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_items_view_func();


--
-- Name: item_properties refresh_items_view_prop_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER refresh_items_view_prop_insert AFTER INSERT ON public.item_properties FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_items_view_func();


--
-- Name: item_properties refresh_items_view_prop_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER refresh_items_view_prop_update AFTER UPDATE ON public.item_properties FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_items_view_func();


--
-- Name: items refresh_items_view_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER refresh_items_view_update AFTER UPDATE ON public.items FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_items_view_func();


--
-- Name: customer_transactions set_customer_transaction_name; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_customer_transaction_name BEFORE INSERT ON public.customer_transactions FOR EACH ROW EXECUTE FUNCTION public.set_customer_transaction_item_name();


--
-- Name: item_transactions set_item_transaction_name; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_item_transaction_name BEFORE INSERT ON public.item_transactions FOR EACH ROW EXECUTE FUNCTION public.set_transaction_item_name();


--
-- Name: boxes soft_delete_box_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER soft_delete_box_trigger BEFORE DELETE ON public.boxes FOR EACH ROW EXECUTE FUNCTION public.soft_delete_box();


--
-- Name: boxes update_boxes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_boxes_updated_at BEFORE UPDATE ON public.boxes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: colors update_colors_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_colors_updated_at BEFORE UPDATE ON public.colors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: item_properties update_item_properties_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_item_properties_timestamp BEFORE UPDATE ON public.item_properties FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: item_properties update_item_properties_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_item_properties_updated_at BEFORE UPDATE ON public.item_properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: items update_items_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_items_timestamp BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: items update_items_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: locations update_locations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: roles update_roles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shelves update_shelves_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_shelves_updated_at BEFORE UPDATE ON public.shelves FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: item_properties update_item_properties_timestamp; Type: TRIGGER; Schema: test_schema; Owner: postgres
--

CREATE TRIGGER update_item_properties_timestamp BEFORE UPDATE ON test_schema.item_properties FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: items update_items_timestamp; Type: TRIGGER; Schema: test_schema; Owner: postgres
--

CREATE TRIGGER update_items_timestamp BEFORE UPDATE ON test_schema.items FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: boxes boxes_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boxes
    ADD CONSTRAINT boxes_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: boxes boxes_shelf_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boxes
    ADD CONSTRAINT boxes_shelf_id_fkey FOREIGN KEY (shelf_id) REFERENCES public.shelves(id) ON DELETE SET NULL;


--
-- Name: customer_transactions customer_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_transactions
    ADD CONSTRAINT customer_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_transactions customer_transactions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_transactions
    ADD CONSTRAINT customer_transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE SET NULL;


--
-- Name: customer_transactions customer_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_transactions
    ADD CONSTRAINT customer_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: items fk_parent_item; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT fk_parent_item FOREIGN KEY (parent_item_id) REFERENCES public.items(id) ON DELETE SET NULL;


--
-- Name: item_properties item_properties_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_properties
    ADD CONSTRAINT item_properties_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: item_transactions item_transactions_box_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_box_id_fkey FOREIGN KEY (box_id) REFERENCES public.boxes(id) ON DELETE SET NULL;


--
-- Name: item_transactions item_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: item_transactions item_transactions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE SET NULL;


--
-- Name: item_transactions item_transactions_new_box_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_new_box_id_fkey FOREIGN KEY (new_box_id) REFERENCES public.boxes(id) ON DELETE SET NULL;


--
-- Name: item_transactions item_transactions_previous_box_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_previous_box_id_fkey FOREIGN KEY (previous_box_id) REFERENCES public.boxes(id) ON DELETE SET NULL;


--
-- Name: item_transactions item_transactions_related_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_related_item_id_fkey FOREIGN KEY (related_item_id) REFERENCES public.items(id) ON DELETE SET NULL;


--
-- Name: item_transactions item_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: items items_box_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_box_id_fkey FOREIGN KEY (box_id) REFERENCES public.boxes(id) ON DELETE SET NULL;


--
-- Name: shelves shelves_color_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shelves
    ADD CONSTRAINT shelves_color_id_fkey FOREIGN KEY (color_id) REFERENCES public.colors(id) ON DELETE SET NULL;


--
-- Name: shelves shelves_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shelves
    ADD CONSTRAINT shelves_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_box_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_box_id_fkey FOREIGN KEY (box_id) REFERENCES public.boxes(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_groups user_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: user_groups user_groups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: item_audit_log item_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_audit_log
    ADD CONSTRAINT item_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: item_images item_images_item_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_images
    ADD CONSTRAINT item_images_item_id_fkey FOREIGN KEY (item_id) REFERENCES test_schema.items(id) ON DELETE CASCADE;


--
-- Name: item_properties item_properties_item_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_properties
    ADD CONSTRAINT item_properties_item_id_fkey FOREIGN KEY (item_id) REFERENCES test_schema.items(id) ON DELETE CASCADE;


--
-- Name: item_tag_relations item_tag_relations_item_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_tag_relations
    ADD CONSTRAINT item_tag_relations_item_id_fkey FOREIGN KEY (item_id) REFERENCES test_schema.items(id) ON DELETE CASCADE;


--
-- Name: item_tag_relations item_tag_relations_tag_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_tag_relations
    ADD CONSTRAINT item_tag_relations_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES test_schema.item_tags(id) ON DELETE CASCADE;


--
-- Name: item_transactions item_transactions_box_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_transactions
    ADD CONSTRAINT item_transactions_box_id_fkey FOREIGN KEY (box_id) REFERENCES public.boxes(id) ON DELETE SET NULL;


--
-- Name: item_transactions item_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_transactions
    ADD CONSTRAINT item_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: item_transactions item_transactions_item_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_transactions
    ADD CONSTRAINT item_transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES test_schema.items(id) ON DELETE CASCADE;


--
-- Name: item_transactions item_transactions_previous_box_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_transactions
    ADD CONSTRAINT item_transactions_previous_box_id_fkey FOREIGN KEY (previous_box_id) REFERENCES public.boxes(id) ON DELETE SET NULL;


--
-- Name: item_transactions item_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.item_transactions
    ADD CONSTRAINT item_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: items items_box_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.items
    ADD CONSTRAINT items_box_id_fkey FOREIGN KEY (box_id) REFERENCES public.boxes(id) ON DELETE SET NULL;


--
-- Name: items items_parent_item_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.items
    ADD CONSTRAINT items_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES test_schema.items(id) ON DELETE SET NULL;


--
-- Name: transaction_metadata transaction_metadata_approved_by_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.transaction_metadata
    ADD CONSTRAINT transaction_metadata_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: transaction_metadata transaction_metadata_reason_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.transaction_metadata
    ADD CONSTRAINT transaction_metadata_reason_id_fkey FOREIGN KEY (reason_id) REFERENCES public.removal_reasons(id) ON DELETE SET NULL;


--
-- Name: transaction_metadata transaction_metadata_transaction_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.transaction_metadata
    ADD CONSTRAINT transaction_metadata_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES test_schema.item_transactions(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- Name: items_complete_view; Type: MATERIALIZED VIEW DATA; Schema: public; Owner: postgres
--

REFRESH MATERIALIZED VIEW public.items_complete_view;


--
-- Name: items_complete_data; Type: MATERIALIZED VIEW DATA; Schema: test_schema; Owner: postgres
--

REFRESH MATERIALIZED VIEW test_schema.items_complete_data;


--
-- PostgreSQL database dump complete
--

