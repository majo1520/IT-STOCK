--
-- PostgreSQL database dump
--

-- Dumped from database version 15.12 (Debian 15.12-0+deb12u2)
-- Dumped by pg_dump version 15.12 (Debian 15.12-0+deb12u2)

-- Started on 2025-05-16 09:38:27 CEST

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
-- TOC entry 881 (class 1247 OID 16698)
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
-- TOC entry 875 (class 1247 OID 16638)
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
-- TOC entry 878 (class 1247 OID 16648)
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
-- TOC entry 249 (class 1255 OID 40980)
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
-- TOC entry 252 (class 1255 OID 49309)
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
-- TOC entry 251 (class 1255 OID 49226)
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
-- TOC entry 250 (class 1255 OID 40983)
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
-- TOC entry 248 (class 1255 OID 16427)
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
-- TOC entry 215 (class 1259 OID 16708)
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
-- TOC entry 3656 (class 0 OID 0)
-- Dependencies: 215
-- Name: COLUMN boxes.reference_uuid; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.boxes.reference_uuid IS 'Permanent unique identifier that will never be reused, even after box deletion';


--
-- TOC entry 3657 (class 0 OID 0)
-- Dependencies: 215
-- Name: COLUMN boxes.barcode_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.boxes.barcode_data IS 'Formatted data for Code128 barcode, combining location, shelf, box number and reference';


--
-- TOC entry 3658 (class 0 OID 0)
-- Dependencies: 215
-- Name: COLUMN boxes.deleted_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.boxes.deleted_at IS 'Timestamp when box was deleted (null means active box)';


--
-- TOC entry 3659 (class 0 OID 0)
-- Dependencies: 215
-- Name: COLUMN boxes.reference_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.boxes.reference_id IS 'Unique reference ID for the box, used for QR codes and labels';


--
-- TOC entry 214 (class 1259 OID 16707)
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
-- TOC entry 3660 (class 0 OID 0)
-- Dependencies: 214
-- Name: boxes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.boxes_id_seq OWNED BY public.boxes.id;


--
-- TOC entry 231 (class 1259 OID 24637)
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
-- TOC entry 230 (class 1259 OID 24636)
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
-- TOC entry 3661 (class 0 OID 0)
-- Dependencies: 230
-- Name: colors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.colors_id_seq OWNED BY public.colors.id;


--
-- TOC entry 243 (class 1259 OID 49280)
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
-- TOC entry 3662 (class 0 OID 0)
-- Dependencies: 243
-- Name: TABLE customer_transactions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.customer_transactions IS 'Stores all customer consumption transactions';


--
-- TOC entry 242 (class 1259 OID 49279)
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
-- TOC entry 3663 (class 0 OID 0)
-- Dependencies: 242
-- Name: customer_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_transactions_id_seq OWNED BY public.customer_transactions.id;


--
-- TOC entry 227 (class 1259 OID 24611)
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
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 24610)
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
-- TOC entry 3664 (class 0 OID 0)
-- Dependencies: 226
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- TOC entry 245 (class 1259 OID 49312)
-- Name: db_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.db_migrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.db_migrations OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 49311)
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
-- TOC entry 3665 (class 0 OID 0)
-- Dependencies: 244
-- Name: db_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.db_migrations_id_seq OWNED BY public.db_migrations.id;


--
-- TOC entry 223 (class 1259 OID 24577)
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
-- TOC entry 222 (class 1259 OID 24576)
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
-- TOC entry 3666 (class 0 OID 0)
-- Dependencies: 222
-- Name: groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.groups_id_seq OWNED BY public.groups.id;


--
-- TOC entry 237 (class 1259 OID 49153)
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
-- TOC entry 3667 (class 0 OID 0)
-- Dependencies: 237
-- Name: TABLE item_properties; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.item_properties IS 'Stores additional item properties that were previously stored in localStorage';


--
-- TOC entry 236 (class 1259 OID 49152)
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
-- TOC entry 3668 (class 0 OID 0)
-- Dependencies: 236
-- Name: item_properties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.item_properties_id_seq OWNED BY public.item_properties.id;


--
-- TOC entry 239 (class 1259 OID 49176)
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
-- TOC entry 3669 (class 0 OID 0)
-- Dependencies: 239
-- Name: TABLE item_transactions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.item_transactions IS 'Stores all item transaction history, replacing localStorage implementation';


--
-- TOC entry 238 (class 1259 OID 49175)
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
-- TOC entry 3670 (class 0 OID 0)
-- Dependencies: 238
-- Name: item_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.item_transactions_id_seq OWNED BY public.item_transactions.id;


--
-- TOC entry 219 (class 1259 OID 16732)
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
    qr_code character varying(255)
);


ALTER TABLE public.items OWNER TO postgres;

--
-- TOC entry 3671 (class 0 OID 0)
-- Dependencies: 219
-- Name: COLUMN items.parent_item_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.items.parent_item_id IS 'References the parent item ID for hierarchical relationships';


--
-- TOC entry 3672 (class 0 OID 0)
-- Dependencies: 219
-- Name: COLUMN items.qr_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.items.qr_code IS 'Unique QR code identifier for the item';


--
-- TOC entry 218 (class 1259 OID 16731)
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
-- TOC entry 3673 (class 0 OID 0)
-- Dependencies: 218
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- TOC entry 229 (class 1259 OID 24624)
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
-- TOC entry 228 (class 1259 OID 24623)
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
-- TOC entry 3674 (class 0 OID 0)
-- Dependencies: 228
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- TOC entry 235 (class 1259 OID 40961)
-- Name: migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.migrations OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 40960)
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
-- TOC entry 3675 (class 0 OID 0)
-- Dependencies: 234
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- TOC entry 247 (class 1259 OID 49334)
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
-- TOC entry 246 (class 1259 OID 49333)
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
-- TOC entry 3676 (class 0 OID 0)
-- Dependencies: 246
-- Name: removal_reasons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.removal_reasons_id_seq OWNED BY public.removal_reasons.id;


--
-- TOC entry 241 (class 1259 OID 49229)
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
-- TOC entry 3677 (class 0 OID 0)
-- Dependencies: 241
-- Name: TABLE roles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.roles IS 'Stores customer and user roles with their display colors';


--
-- TOC entry 240 (class 1259 OID 49228)
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
-- TOC entry 3678 (class 0 OID 0)
-- Dependencies: 240
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- TOC entry 233 (class 1259 OID 24648)
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
-- TOC entry 232 (class 1259 OID 24647)
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
-- TOC entry 3679 (class 0 OID 0)
-- Dependencies: 232
-- Name: shelves_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shelves_id_seq OWNED BY public.shelves.id;


--
-- TOC entry 217 (class 1259 OID 16717)
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
-- TOC entry 216 (class 1259 OID 16716)
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
-- TOC entry 3680 (class 0 OID 0)
-- Dependencies: 216
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- TOC entry 225 (class 1259 OID 24588)
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
-- TOC entry 224 (class 1259 OID 24587)
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
-- TOC entry 3681 (class 0 OID 0)
-- Dependencies: 224
-- Name: user_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_groups_id_seq OWNED BY public.user_groups.id;


--
-- TOC entry 221 (class 1259 OID 16756)
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
-- TOC entry 220 (class 1259 OID 16755)
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
-- TOC entry 3682 (class 0 OID 0)
-- Dependencies: 220
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 3293 (class 2604 OID 16711)
-- Name: boxes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boxes ALTER COLUMN id SET DEFAULT nextval('public.boxes_id_seq'::regclass);


--
-- TOC entry 3318 (class 2604 OID 24640)
-- Name: colors id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.colors ALTER COLUMN id SET DEFAULT nextval('public.colors_id_seq'::regclass);


--
-- TOC entry 3336 (class 2604 OID 49283)
-- Name: customer_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_transactions ALTER COLUMN id SET DEFAULT nextval('public.customer_transactions_id_seq'::regclass);


--
-- TOC entry 3312 (class 2604 OID 24614)
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- TOC entry 3340 (class 2604 OID 49315)
-- Name: db_migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.db_migrations ALTER COLUMN id SET DEFAULT nextval('public.db_migrations_id_seq'::regclass);


--
-- TOC entry 3307 (class 2604 OID 24580)
-- Name: groups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.groups ALTER COLUMN id SET DEFAULT nextval('public.groups_id_seq'::regclass);


--
-- TOC entry 3326 (class 2604 OID 49156)
-- Name: item_properties id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_properties ALTER COLUMN id SET DEFAULT nextval('public.item_properties_id_seq'::regclass);


--
-- TOC entry 3329 (class 2604 OID 49179)
-- Name: item_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions ALTER COLUMN id SET DEFAULT nextval('public.item_transactions_id_seq'::regclass);


--
-- TOC entry 3299 (class 2604 OID 16735)
-- Name: items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- TOC entry 3315 (class 2604 OID 24627)
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- TOC entry 3324 (class 2604 OID 40964)
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- TOC entry 3342 (class 2604 OID 49337)
-- Name: removal_reasons id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.removal_reasons ALTER COLUMN id SET DEFAULT nextval('public.removal_reasons_id_seq'::regclass);


--
-- TOC entry 3332 (class 2604 OID 49232)
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- TOC entry 3321 (class 2604 OID 24651)
-- Name: shelves id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shelves ALTER COLUMN id SET DEFAULT nextval('public.shelves_id_seq'::regclass);


--
-- TOC entry 3297 (class 2604 OID 16720)
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- TOC entry 3310 (class 2604 OID 24591)
-- Name: user_groups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_groups ALTER COLUMN id SET DEFAULT nextval('public.user_groups_id_seq'::regclass);


--
-- TOC entry 3303 (class 2604 OID 16759)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3618 (class 0 OID 16708)
-- Dependencies: 215
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
-- TOC entry 3634 (class 0 OID 24637)
-- Dependencies: 231
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
-- TOC entry 3646 (class 0 OID 49280)
-- Dependencies: 243
-- Data for Name: customer_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_transactions (id, customer_id, item_id, item_name, quantity, notes, transaction_type, transaction_date, created_by, user_id) FROM stdin;
\.


--
-- TOC entry 3630 (class 0 OID 24611)
-- Dependencies: 227
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, name, contact_person, email, phone, address, group_name, notes, created_at, updated_at) FROM stdin;
1	europlac	Ferko Blaska				\N	LEADER H7	2025-05-11 01:25:48.561539+02	2025-05-12 13:45:34.025653+02
\.


--
-- TOC entry 3648 (class 0 OID 49312)
-- Dependencies: 245
-- Data for Name: db_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.db_migrations (id, name, applied_at) FROM stdin;
1	001_add_performance_indexes.js	2025-05-15 15:37:36.268169+02
2	002_create_customer_transactions_table.js	2025-05-15 15:37:36.282487+02
3	003_create_item_transactions_table.js	2025-05-15 15:37:36.310816+02
\.


--
-- TOC entry 3626 (class 0 OID 24577)
-- Dependencies: 223
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
-- TOC entry 3640 (class 0 OID 49153)
-- Dependencies: 237
-- Data for Name: item_properties; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.item_properties (id, item_id, type, ean_code, serial_number, additional_data, created_at, updated_at) FROM stdin;
3	1	Electronic	1234567890123	SN12345	{}	2025-05-15 08:58:54.146529+02	2025-05-15 08:58:54.146529+02
4	2	Accessory	9876543210987	SN67890	{}	2025-05-15 08:58:54.146529+02	2025-05-15 08:58:54.146529+02
6	15	\N	EPL-IT-STOCK-15-TR4K	\N	{}	2025-05-15 11:06:06.726881+02	2025-05-15 11:06:06.726881+02
7	3	\N	EPL-IT-STOCK-3-XRAW	\N	{}	2025-05-15 11:24:24.922974+02	2025-05-15 11:24:24.922974+02
9	11				{}	2025-05-15 15:11:34.780134+02	2025-05-15 15:11:34.780134+02
5	6	\N	EPL-IT-STOCK-6-N57G	\N	{}	2025-05-15 10:24:22.51079+02	2025-05-15 15:12:09.431419+02
8	10		8595574413025		{}	2025-05-15 14:06:19.444739+02	2025-05-15 15:54:31.268583+02
10	8				{}	2025-05-15 15:55:59.735435+02	2025-05-15 15:55:59.735435+02
11	12	\N	EPL-IT-STOCK-12-YLZ6	\N	{}	2025-05-15 16:06:47.106208+02	2025-05-15 16:06:47.106208+02
12	16	\N	EPL-IT-STOCK-16-WO2T	\N	{}	2025-05-15 16:06:47.171059+02	2025-05-15 16:06:47.171059+02
13	17	\N	\N	\N	{}	2025-05-16 09:18:00.5778+02	2025-05-16 09:18:00.5778+02
\.


--
-- TOC entry 3642 (class 0 OID 49176)
-- Dependencies: 239
-- Data for Name: item_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.item_transactions (id, item_id, item_name, transaction_type, quantity, previous_quantity, new_quantity, box_id, previous_box_id, new_box_id, related_item_id, related_item_name, customer_id, supplier, notes, created_by, user_id, created_at, metadata, details) FROM stdin;
5	1	Test Item 1	STOCK_IN	10	0	10	1	\N	\N	\N	\N	\N	\N	Initial stock	system	\N	2023-01-01 13:00:00+01	\N	\N
6	2	Test Item 2	STOCK_IN	5	0	5	2	\N	\N	\N	\N	\N	\N	Initial stock	system	\N	2023-01-02 13:00:00+01	\N	\N
7	1	Test Item 1	STOCK_OUT	2	10	8	1	\N	\N	\N	\N	\N	\N	Stock removed from inventory	system	\N	2023-01-03 13:00:00+01	\N	\N
8	6	DVI 5m	STOCK_OUT	1	2	1	3	\N	\N	\N	\N	1	\N	\N	Milan	1	2025-05-15 14:06:41.058935+02	\N	\N
9	10	285A	STOCK_OUT	1	5	4	6	\N	\N	\N	\N	1	\N	\N	Milan	1	2025-05-15 14:42:33.567955+02	\N	\N
10	10	285A	STOCK_OUT	1	4	3	6	\N	\N	\N	\N	1	\N	\N	Milan	1	2025-05-15 14:49:36.092513+02	\N	\N
11	10	285A	STOCK_OUT	1	3	2	6	\N	\N	\N	\N	1	\N	Removed due to: CONSUMED	Milan	1	2025-05-15 15:21:19.858232+02	\N	\N
12	10	285A	STOCK_OUT	1	2	1	6	\N	\N	\N	\N	1	\N	Removed due to: CONSUMED	Milan	1	2025-05-15 15:54:31.069341+02	\N	\N
13	8	hdmi 2m	STOCK_OUT	1	7	6	3	\N	\N	\N	\N	1	\N	Removed due to: CONSUMED	Milan	1	2025-05-15 15:55:59.664967+02	\N	\N
\.


--
-- TOC entry 3622 (class 0 OID 16732)
-- Dependencies: 219
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.items (id, name, description, quantity, box_id, created_at, updated_at, supplier, parent_item_id, type, ean_code, serial_number, qr_code) FROM stdin;
17	CRG052	\N	10	6	2025-05-16 09:18:00.485431+02	2025-05-16 09:18:00.585243+02	\N	\N	\N	\N	\N	\N
5	DVI cables 	\N	3	\N	2025-05-11 00:25:01.30191+02	2025-05-14 14:39:58.381229+02	\N	\N	\N	\N	\N	\N
4	HDMI 1.5m	\N	5	3	2025-05-11 00:09:33.89983+02	2025-05-14 14:40:59.340608+02	\N	\N	\N	\N	\N	\N
7	HDMI 5m	golden connectors	15	3	2025-05-11 00:50:03.815554+02	2025-05-14 14:41:20.687512+02	\N	\N	\N	\N	\N	\N
14	EPSON 112 YELLOW	\N	3	6	2025-05-14 14:11:13.749643+02	2025-05-14 15:27:46.60286+02	DAMEDIS	\N	\N	\N	\N	\N
1	Test Item 1	\N	0	\N	2025-05-15 08:58:54.109648+02	2025-05-15 08:58:54.146529+02	\N	\N	Electronic	1234567890123	SN12345	\N
2	HDMI cables	\N	10	3	2025-05-08 12:41:20.342188+02	2025-05-15 08:58:54.146529+02	\N	1	Accessory	9876543210987	SN67890	\N
15	EPSON 112 BLACK	\N	3	6	2025-05-14 14:11:43.109334+02	2025-05-15 11:06:06.731764+02	DAMEDIS	\N	\N	EPL-IT-STOCK-15-TR4K	\N	\N
3	SAMSUNG SSD 1TB	\N	1	\N	2025-05-08 14:30:10.153849+02	2025-05-15 11:24:24.92608+02	\N	\N	\N	EPL-IT-STOCK-3-XRAW	\N	\N
11	DATALOGIC QW2120	\N	2	\N	2025-05-13 07:57:30.38592+02	2025-05-15 15:11:34.791383+02	DATALOGIC	\N				\N
6	DVI 5m	\N	1	3	2025-05-11 00:25:16.952055+02	2025-05-15 15:12:09.434661+02	\N	\N	\N	EPL-IT-STOCK-6-N57G	\N	\N
10	285A	\N	1	6	2025-05-12 16:10:47.063226+02	2025-05-15 15:54:31.27381+02	\N	\N		8595574413025		\N
8	hdmi 2m	\N	6	3	2025-05-11 01:10:27.546846+02	2025-05-15 15:55:59.740579+02	\N	\N				\N
12	EPSON 112 CYAN	\N	3	\N	2025-05-14 14:09:52.292752+02	2025-05-15 16:06:47.114281+02	\N	\N	\N	EPL-IT-STOCK-12-YLZ6	\N	\N
16	EPSON 112 MAGENTA	\N	3	\N	2025-05-14 14:12:08.288368+02	2025-05-15 16:06:47.178841+02	\N	\N	\N	EPL-IT-STOCK-16-WO2T	\N	\N
\.


--
-- TOC entry 3632 (class 0 OID 24624)
-- Dependencies: 229
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.locations (id, name, description, color, created_at, updated_at) FROM stdin;
4	FINANCIAL STOCK	Financial department storage	#f5d866	2025-05-08 23:13:35.100064+02	2025-05-08 23:30:13.989608+02
2	IT HOUSE	External IT storage facility	#66f4b7	2025-05-08 23:13:35.100064+02	2025-05-08 23:30:22.295324+02
1	IT OFFICE	IT department main office	#6ea2f7	2025-05-08 23:13:35.100064+02	2025-05-08 23:30:28.67043+02
3	SERVER ROOM	Main server room	#f96c6c	2025-05-08 23:13:35.100064+02	2025-05-08 23:30:34.933172+02
\.


--
-- TOC entry 3638 (class 0 OID 40961)
-- Dependencies: 235
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
-- TOC entry 3650 (class 0 OID 49334)
-- Dependencies: 247
-- Data for Name: removal_reasons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.removal_reasons (id, name, description, created_at, updated_at) FROM stdin;
1	CONSUMED	Item was consumed or used up	2025-05-16 09:02:24.018548	2025-05-16 09:02:24.018548
2	DAMAGED	Item was damaged and cannot be used	2025-05-16 09:02:24.023041	2025-05-16 09:02:24.023041
3	EXPIRED	Item has expired	2025-05-16 09:02:24.025821	2025-05-16 09:02:24.025821
4	SOLD	Item was sold to a customer	2025-05-16 09:02:24.028302	2025-05-16 09:02:24.028302
5	RETURNED	Item was returned to supplier	2025-05-16 09:02:24.031798	2025-05-16 09:02:24.031798
6	LOST	Item was lost	2025-05-16 09:02:24.035411	2025-05-16 09:02:24.035411
7	OTHER	Other reason	2025-05-16 09:02:24.038977	2025-05-16 09:02:24.038977
\.


--
-- TOC entry 3644 (class 0 OID 49229)
-- Dependencies: 241
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
-- TOC entry 3636 (class 0 OID 24648)
-- Dependencies: 233
-- Data for Name: shelves; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shelves (id, name, location_id, color_id, description, created_at, updated_at) FROM stdin;
1	A1	1	8		2025-05-08 23:25:32.360378+02	2025-05-08 23:25:32.360378+02
2	IT HOUSE	2	2		2025-05-11 01:38:08.424359+02	2025-05-11 01:38:08.424359+02
\.


--
-- TOC entry 3620 (class 0 OID 16717)
-- Dependencies: 217
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
\.


--
-- TOC entry 3628 (class 0 OID 24588)
-- Dependencies: 225
-- Data for Name: user_groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_groups (id, user_id, group_id, created_at) FROM stdin;
\.


--
-- TOC entry 3624 (class 0 OID 16756)
-- Dependencies: 221
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password, email, full_name, role, created_at, updated_at) FROM stdin;
1	Milan	$2b$10$Md72N0fre7KEHn9YekLq9ee4GgCYGCQGAQ3bhRf2jzxfR/uGAcM3i	m.barat@europlac.com	Milan Barat	admin	2025-05-08 13:33:04.415175+02	2025-05-08 14:03:40.016269+02
2	admin	$2b$10$G6XtSq5vTaP.PkF7Q69aDehljI2yTpesX89.lMzXDzbfVvwIdt2qO	admin@europlac.com	admin admin	admin	2025-05-08 14:04:03.375058+02	2025-05-08 14:04:03.375058+02
6	ITSTOCK	$2b$10$0uKQYCMZiKLTBwoAlKB7yeJlKRXSP4hOf6fFo836rbFmtG6s1GC0K	\N	ITSTOCK OFFICE	admin	2025-05-16 09:37:51.824361+02	2025-05-16 09:37:51.824361+02
\.


--
-- TOC entry 3683 (class 0 OID 0)
-- Dependencies: 214
-- Name: boxes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.boxes_id_seq', 6, true);


--
-- TOC entry 3684 (class 0 OID 0)
-- Dependencies: 230
-- Name: colors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.colors_id_seq', 18, true);


--
-- TOC entry 3685 (class 0 OID 0)
-- Dependencies: 242
-- Name: customer_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_transactions_id_seq', 1, false);


--
-- TOC entry 3686 (class 0 OID 0)
-- Dependencies: 226
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 1, true);


--
-- TOC entry 3687 (class 0 OID 0)
-- Dependencies: 244
-- Name: db_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.db_migrations_id_seq', 3, true);


--
-- TOC entry 3688 (class 0 OID 0)
-- Dependencies: 222
-- Name: groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.groups_id_seq', 5, true);


--
-- TOC entry 3689 (class 0 OID 0)
-- Dependencies: 236
-- Name: item_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.item_properties_id_seq', 13, true);


--
-- TOC entry 3690 (class 0 OID 0)
-- Dependencies: 238
-- Name: item_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.item_transactions_id_seq', 13, true);


--
-- TOC entry 3691 (class 0 OID 0)
-- Dependencies: 218
-- Name: items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.items_id_seq', 17, true);


--
-- TOC entry 3692 (class 0 OID 0)
-- Dependencies: 228
-- Name: locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.locations_id_seq', 8, true);


--
-- TOC entry 3693 (class 0 OID 0)
-- Dependencies: 234
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.migrations_id_seq', 15, true);


--
-- TOC entry 3694 (class 0 OID 0)
-- Dependencies: 246
-- Name: removal_reasons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.removal_reasons_id_seq', 7, true);


--
-- TOC entry 3695 (class 0 OID 0)
-- Dependencies: 240
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roles_id_seq', 5, true);


--
-- TOC entry 3696 (class 0 OID 0)
-- Dependencies: 232
-- Name: shelves_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shelves_id_seq', 2, true);


--
-- TOC entry 3697 (class 0 OID 0)
-- Dependencies: 216
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transactions_id_seq', 43, true);


--
-- TOC entry 3698 (class 0 OID 0)
-- Dependencies: 224
-- Name: user_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_groups_id_seq', 1, false);


--
-- TOC entry 3699 (class 0 OID 0)
-- Dependencies: 220
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 6, true);


--
-- TOC entry 3346 (class 2606 OID 16715)
-- Name: boxes boxes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boxes
    ADD CONSTRAINT boxes_pkey PRIMARY KEY (id);


--
-- TOC entry 3396 (class 2606 OID 24646)
-- Name: colors colors_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.colors
    ADD CONSTRAINT colors_name_key UNIQUE (name);


--
-- TOC entry 3398 (class 2606 OID 24644)
-- Name: colors colors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.colors
    ADD CONSTRAINT colors_pkey PRIMARY KEY (id);


--
-- TOC entry 3429 (class 2606 OID 49290)
-- Name: customer_transactions customer_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_transactions
    ADD CONSTRAINT customer_transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 3387 (class 2606 OID 24620)
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- TOC entry 3435 (class 2606 OID 49320)
-- Name: db_migrations db_migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.db_migrations
    ADD CONSTRAINT db_migrations_name_key UNIQUE (name);


--
-- TOC entry 3437 (class 2606 OID 49318)
-- Name: db_migrations db_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.db_migrations
    ADD CONSTRAINT db_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 3378 (class 2606 OID 24586)
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- TOC entry 3415 (class 2606 OID 49162)
-- Name: item_properties item_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_properties
    ADD CONSTRAINT item_properties_pkey PRIMARY KEY (id);


--
-- TOC entry 3425 (class 2606 OID 49185)
-- Name: item_transactions item_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 3370 (class 2606 OID 16742)
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- TOC entry 3392 (class 2606 OID 24635)
-- Name: locations locations_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_name_key UNIQUE (name);


--
-- TOC entry 3394 (class 2606 OID 24633)
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- TOC entry 3408 (class 2606 OID 40969)
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- TOC entry 3410 (class 2606 OID 40967)
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 3440 (class 2606 OID 49343)
-- Name: removal_reasons removal_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.removal_reasons
    ADD CONSTRAINT removal_reasons_pkey PRIMARY KEY (id);


--
-- TOC entry 3427 (class 2606 OID 49239)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 3404 (class 2606 OID 24659)
-- Name: shelves shelves_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shelves
    ADD CONSTRAINT shelves_name_key UNIQUE (name);


--
-- TOC entry 3406 (class 2606 OID 24657)
-- Name: shelves shelves_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shelves
    ADD CONSTRAINT shelves_pkey PRIMARY KEY (id);


--
-- TOC entry 3359 (class 2606 OID 16725)
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 3354 (class 2606 OID 40979)
-- Name: boxes unique_box_reference; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boxes
    ADD CONSTRAINT unique_box_reference UNIQUE (reference_uuid);


--
-- TOC entry 3383 (class 2606 OID 24594)
-- Name: user_groups user_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_pkey PRIMARY KEY (id);


--
-- TOC entry 3385 (class 2606 OID 24596)
-- Name: user_groups user_groups_user_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_user_id_group_id_key UNIQUE (user_id, group_id);


--
-- TOC entry 3372 (class 2606 OID 16768)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3374 (class 2606 OID 16764)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3376 (class 2606 OID 16766)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 3347 (class 1259 OID 49324)
-- Name: idx_boxes_box_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boxes_box_number ON public.boxes USING btree (box_number);


--
-- TOC entry 3348 (class 1259 OID 24690)
-- Name: idx_boxes_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boxes_created_by ON public.boxes USING btree (created_by);


--
-- TOC entry 3349 (class 1259 OID 40982)
-- Name: idx_boxes_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boxes_deleted_at ON public.boxes USING btree (deleted_at);


--
-- TOC entry 3350 (class 1259 OID 24686)
-- Name: idx_boxes_location_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boxes_location_id ON public.boxes USING btree (location_id);


--
-- TOC entry 3351 (class 1259 OID 40985)
-- Name: idx_boxes_reference_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boxes_reference_id ON public.boxes USING btree (reference_id);


--
-- TOC entry 3352 (class 1259 OID 24685)
-- Name: idx_boxes_shelf_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boxes_shelf_id ON public.boxes USING btree (shelf_id);


--
-- TOC entry 3399 (class 1259 OID 24681)
-- Name: idx_colors_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_colors_name ON public.colors USING btree (name);


--
-- TOC entry 3430 (class 1259 OID 49306)
-- Name: idx_customer_transactions_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_transactions_customer_id ON public.customer_transactions USING btree (customer_id);


--
-- TOC entry 3431 (class 1259 OID 49307)
-- Name: idx_customer_transactions_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_transactions_item_id ON public.customer_transactions USING btree (item_id);


--
-- TOC entry 3432 (class 1259 OID 49308)
-- Name: idx_customer_transactions_transaction_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_transactions_transaction_date ON public.customer_transactions USING btree (transaction_date);


--
-- TOC entry 3433 (class 1259 OID 49327)
-- Name: idx_customer_transactions_transaction_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_transactions_transaction_type ON public.customer_transactions USING btree (transaction_type);


--
-- TOC entry 3388 (class 1259 OID 24622)
-- Name: idx_customers_group_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_group_name ON public.customers USING btree (group_name);


--
-- TOC entry 3389 (class 1259 OID 24621)
-- Name: idx_customers_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_name ON public.customers USING btree (name);


--
-- TOC entry 3379 (class 1259 OID 24607)
-- Name: idx_groups_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_groups_name ON public.groups USING btree (name);


--
-- TOC entry 3411 (class 1259 OID 49169)
-- Name: idx_item_properties_ean_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_properties_ean_code ON public.item_properties USING btree (ean_code);


--
-- TOC entry 3412 (class 1259 OID 49168)
-- Name: idx_item_properties_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_item_properties_item_id ON public.item_properties USING btree (item_id);


--
-- TOC entry 3413 (class 1259 OID 49170)
-- Name: idx_item_properties_serial_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_properties_serial_number ON public.item_properties USING btree (serial_number);


--
-- TOC entry 3416 (class 1259 OID 49222)
-- Name: idx_item_transactions_box_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_box_id ON public.item_transactions USING btree (box_id);


--
-- TOC entry 3417 (class 1259 OID 49224)
-- Name: idx_item_transactions_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_created_at ON public.item_transactions USING btree (created_at);


--
-- TOC entry 3418 (class 1259 OID 49225)
-- Name: idx_item_transactions_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_customer_id ON public.item_transactions USING btree (customer_id);


--
-- TOC entry 3419 (class 1259 OID 49221)
-- Name: idx_item_transactions_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_item_id ON public.item_transactions USING btree (item_id);


--
-- TOC entry 3420 (class 1259 OID 49332)
-- Name: idx_item_transactions_item_id_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_item_id_created_at ON public.item_transactions USING btree (item_id, created_at DESC);


--
-- TOC entry 3421 (class 1259 OID 49329)
-- Name: idx_item_transactions_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_supplier ON public.item_transactions USING btree (supplier);


--
-- TOC entry 3422 (class 1259 OID 49223)
-- Name: idx_item_transactions_transaction_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_transaction_type ON public.item_transactions USING btree (transaction_type);


--
-- TOC entry 3423 (class 1259 OID 49328)
-- Name: idx_item_transactions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_transactions_user_id ON public.item_transactions USING btree (user_id);


--
-- TOC entry 3360 (class 1259 OID 49330)
-- Name: idx_items_box_id_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_box_id_name ON public.items USING btree (box_id, name);


--
-- TOC entry 3361 (class 1259 OID 49323)
-- Name: idx_items_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_created_at ON public.items USING btree (created_at);


--
-- TOC entry 3362 (class 1259 OID 49173)
-- Name: idx_items_ean_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_ean_code ON public.items USING btree (ean_code);


--
-- TOC entry 3363 (class 1259 OID 49321)
-- Name: idx_items_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_name ON public.items USING btree (name);


--
-- TOC entry 3364 (class 1259 OID 32773)
-- Name: idx_items_parent_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_parent_item_id ON public.items USING btree (parent_item_id);


--
-- TOC entry 3365 (class 1259 OID 49278)
-- Name: idx_items_qr_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_qr_code ON public.items USING btree (qr_code);


--
-- TOC entry 3366 (class 1259 OID 49174)
-- Name: idx_items_serial_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_serial_number ON public.items USING btree (serial_number);


--
-- TOC entry 3367 (class 1259 OID 49322)
-- Name: idx_items_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_supplier ON public.items USING btree (supplier);


--
-- TOC entry 3368 (class 1259 OID 49172)
-- Name: idx_items_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_type ON public.items USING btree (type);


--
-- TOC entry 3390 (class 1259 OID 24680)
-- Name: idx_locations_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_locations_name ON public.locations USING btree (name);


--
-- TOC entry 3438 (class 1259 OID 49344)
-- Name: idx_removal_reasons_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_removal_reasons_name ON public.removal_reasons USING btree (name);


--
-- TOC entry 3400 (class 1259 OID 24684)
-- Name: idx_shelves_color_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shelves_color_id ON public.shelves USING btree (color_id);


--
-- TOC entry 3401 (class 1259 OID 24683)
-- Name: idx_shelves_location_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shelves_location_id ON public.shelves USING btree (location_id);


--
-- TOC entry 3402 (class 1259 OID 24682)
-- Name: idx_shelves_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shelves_name ON public.shelves USING btree (name);


--
-- TOC entry 3355 (class 1259 OID 49331)
-- Name: idx_transactions_box_id_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_box_id_created_at ON public.transactions USING btree (box_id, created_at DESC);


--
-- TOC entry 3356 (class 1259 OID 49325)
-- Name: idx_transactions_transaction_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_transaction_type ON public.transactions USING btree (transaction_type);


--
-- TOC entry 3357 (class 1259 OID 49326)
-- Name: idx_transactions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_user_id ON public.transactions USING btree (user_id);


--
-- TOC entry 3380 (class 1259 OID 24609)
-- Name: idx_user_groups_group_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_groups_group_id ON public.user_groups USING btree (group_id);


--
-- TOC entry 3381 (class 1259 OID 24608)
-- Name: idx_user_groups_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_groups_user_id ON public.user_groups USING btree (user_id);


--
-- TOC entry 3463 (class 2620 OID 40981)
-- Name: boxes generate_box_barcode_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER generate_box_barcode_trigger BEFORE INSERT OR UPDATE ON public.boxes FOR EACH ROW EXECUTE FUNCTION public.generate_box_barcode();


--
-- TOC entry 3474 (class 2620 OID 49310)
-- Name: customer_transactions set_customer_transaction_name; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_customer_transaction_name BEFORE INSERT ON public.customer_transactions FOR EACH ROW EXECUTE FUNCTION public.set_customer_transaction_item_name();


--
-- TOC entry 3472 (class 2620 OID 49227)
-- Name: item_transactions set_item_transaction_name; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_item_transaction_name BEFORE INSERT ON public.item_transactions FOR EACH ROW EXECUTE FUNCTION public.set_transaction_item_name();


--
-- TOC entry 3464 (class 2620 OID 40984)
-- Name: boxes soft_delete_box_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER soft_delete_box_trigger BEFORE DELETE ON public.boxes FOR EACH ROW EXECUTE FUNCTION public.soft_delete_box();


--
-- TOC entry 3465 (class 2620 OID 16748)
-- Name: boxes update_boxes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_boxes_updated_at BEFORE UPDATE ON public.boxes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3469 (class 2620 OID 24688)
-- Name: colors update_colors_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_colors_updated_at BEFORE UPDATE ON public.colors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3471 (class 2620 OID 49171)
-- Name: item_properties update_item_properties_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_item_properties_updated_at BEFORE UPDATE ON public.item_properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3466 (class 2620 OID 16749)
-- Name: items update_items_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3468 (class 2620 OID 24687)
-- Name: locations update_locations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3473 (class 2620 OID 49240)
-- Name: roles update_roles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3470 (class 2620 OID 24689)
-- Name: shelves update_shelves_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_shelves_updated_at BEFORE UPDATE ON public.shelves FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3467 (class 2620 OID 16769)
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3441 (class 2606 OID 24675)
-- Name: boxes boxes_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boxes
    ADD CONSTRAINT boxes_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- TOC entry 3442 (class 2606 OID 24670)
-- Name: boxes boxes_shelf_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boxes
    ADD CONSTRAINT boxes_shelf_id_fkey FOREIGN KEY (shelf_id) REFERENCES public.shelves(id) ON DELETE SET NULL;


--
-- TOC entry 3460 (class 2606 OID 49291)
-- Name: customer_transactions customer_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_transactions
    ADD CONSTRAINT customer_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 3461 (class 2606 OID 49296)
-- Name: customer_transactions customer_transactions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_transactions
    ADD CONSTRAINT customer_transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE SET NULL;


--
-- TOC entry 3462 (class 2606 OID 49301)
-- Name: customer_transactions customer_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_transactions
    ADD CONSTRAINT customer_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3446 (class 2606 OID 32768)
-- Name: items fk_parent_item; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT fk_parent_item FOREIGN KEY (parent_item_id) REFERENCES public.items(id) ON DELETE SET NULL;


--
-- TOC entry 3452 (class 2606 OID 49163)
-- Name: item_properties item_properties_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_properties
    ADD CONSTRAINT item_properties_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- TOC entry 3453 (class 2606 OID 49191)
-- Name: item_transactions item_transactions_box_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_box_id_fkey FOREIGN KEY (box_id) REFERENCES public.boxes(id) ON DELETE SET NULL;


--
-- TOC entry 3454 (class 2606 OID 49211)
-- Name: item_transactions item_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- TOC entry 3455 (class 2606 OID 49186)
-- Name: item_transactions item_transactions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE SET NULL;


--
-- TOC entry 3456 (class 2606 OID 49201)
-- Name: item_transactions item_transactions_new_box_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_new_box_id_fkey FOREIGN KEY (new_box_id) REFERENCES public.boxes(id) ON DELETE SET NULL;


--
-- TOC entry 3457 (class 2606 OID 49196)
-- Name: item_transactions item_transactions_previous_box_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_previous_box_id_fkey FOREIGN KEY (previous_box_id) REFERENCES public.boxes(id) ON DELETE SET NULL;


--
-- TOC entry 3458 (class 2606 OID 49206)
-- Name: item_transactions item_transactions_related_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_related_item_id_fkey FOREIGN KEY (related_item_id) REFERENCES public.items(id) ON DELETE SET NULL;


--
-- TOC entry 3459 (class 2606 OID 49216)
-- Name: item_transactions item_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_transactions
    ADD CONSTRAINT item_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3447 (class 2606 OID 16743)
-- Name: items items_box_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_box_id_fkey FOREIGN KEY (box_id) REFERENCES public.boxes(id) ON DELETE SET NULL;


--
-- TOC entry 3450 (class 2606 OID 24665)
-- Name: shelves shelves_color_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shelves
    ADD CONSTRAINT shelves_color_id_fkey FOREIGN KEY (color_id) REFERENCES public.colors(id) ON DELETE SET NULL;


--
-- TOC entry 3451 (class 2606 OID 24660)
-- Name: shelves shelves_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shelves
    ADD CONSTRAINT shelves_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- TOC entry 3443 (class 2606 OID 16726)
-- Name: transactions transactions_box_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_box_id_fkey FOREIGN KEY (box_id) REFERENCES public.boxes(id) ON DELETE CASCADE;


--
-- TOC entry 3444 (class 2606 OID 16750)
-- Name: transactions transactions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE SET NULL;


--
-- TOC entry 3445 (class 2606 OID 16770)
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3448 (class 2606 OID 24602)
-- Name: user_groups user_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- TOC entry 3449 (class 2606 OID 24597)
-- Name: user_groups user_groups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- Completed on 2025-05-16 09:38:27 CEST

--
-- PostgreSQL database dump complete
--

