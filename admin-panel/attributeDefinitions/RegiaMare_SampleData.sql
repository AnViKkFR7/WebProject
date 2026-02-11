-- =====================================================================================
-- DATOS DE EJEMPLO PARA REGIAMARE
-- Empresa: RegiaMare (ID: eac2ccbe-cc36-40cd-bb7e-d5fe44de972d)
-- =====================================================================================
-- 
-- Este archivo contiene 2 propiedades de ejemplo realistas:
-- 1. Villa de lujo con piscina en Sitges
-- 2. Piso reformado en el Eixample de Barcelona
--
-- Nota: Estos datos son ficticios pero basados en propiedades reales del mercado
-- =====================================================================================

-- =====================================================================================
-- PROPIEDAD 1: VILLA DE LUJO EN SITGES
-- =====================================================================================

-- Crear el item base
INSERT INTO public.items (id, company_id, title, summary, status, item_type, created_at, updated_at)
VALUES (
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d',
  'Villa de Lujo con Vistas al Mar en Sitges',
  'Espectacular villa moderna con piscina infinity, jardín mediterráneo y vistas panorámicas al mar. A 5 minutos andando de la playa.',
  'published',
  'property',
  NOW(),
  NOW()
);

-- ATRIBUTOS OBLIGATORIOS

-- 1. Precio: 1,850,000 EUR
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  1850000
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'price';

-- 2. Tipo de Operación: Venta
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'Venta'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'operation_type';

-- 3. Tipo de Propiedad: Villa
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'Villa'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'property_type';

-- 4. Provincia: Barcelona
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'Barcelona'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'province';

-- 5. Ciudad: Sitges
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'Sitges'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'city';

-- 6. Zona: Sitges (obligatorio para filtrado)
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'Sitges'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'zone';

-- 7. Superficie Construida: 380 m²
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  380
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'built_surface';

-- 8. Habitaciones: 5
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  5
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'bedrooms';

-- 9. Baños: 4
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  4
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'bathrooms';

-- 10. Estado: Obra Nueva
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'Obra Nueva'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'condition';

-- 11. Descripción Completa
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'Descubra esta excepcional villa de diseño contemporáneo ubicada en una de las zonas más exclusivas de Sitges, con impresionantes vistas panorámicas al mar Mediterráneo.

La propiedad se distribuye en tres plantas conectadas por ascensor y escaleras de diseño. La planta principal alberga un amplio salón-comedor de concepto abierto con techos de doble altura y grandes ventanales que inundan el espacio de luz natural. La cocina de alta gama, completamente equipada con electrodomésticos Miele, se integra perfectamente con el área social y cuenta con acceso directo a la terraza y al jardín.

La zona de noche se compone de 5 dormitorios, todos ellos en suite con baño privado. La suite principal de más de 60 m² incluye vestidor personalizado, baño de lujo con bañera de hidromasaje y ducha de efecto lluvia, además de una terraza privada con vistas al mar.

El exterior es un auténtico oasis mediterráneo: jardín de 800 m² con vegetación autóctona, piscina infinity de 12x5 metros con sistema de cloración salina, zona chill-out cubierta, barbacoa de obra y parking para 3 vehículos.

La vivienda cuenta con domótica integral, sistema de climatización por aerotermia con suelo radiante, placas solares para agua caliente, sistema de seguridad con cámaras perimetrales y alarma conectada. Certificación energética A.

Situada a tan solo 5 minutos andando de las mejores playas de Sitges y del puerto deportivo, y a 10 minutos del centro histórico. Excelente conexión con Barcelona (30 min) y el aeropuerto (20 min) por autopista C-32.'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'description';

-- ATRIBUTOS OPCIONALES RELEVANTES

-- Superficie Útil: 340 m²
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  340
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'usable_surface';

-- Superficie Parcela: 800 m²
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  800
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'plot_surface';

-- Año de Construcción: 2024
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  2024
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'year_built';

-- Parking: Garaje Privado
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'Garaje Privado'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'parking_type';

-- Plazas de Parking: 3
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  3
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'parking_spaces';

-- Tiene Terraza: Sí
INSERT INTO public.attribute_values (item_id, attribute_id, value_boolean)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  true
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'has_terrace';

-- Superficie Terraza: 120 m²
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  120
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'terrace_surface';

-- Tiene Jardín: Sí
INSERT INTO public.attribute_values (item_id, attribute_id, value_boolean)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  true
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'has_garden';

-- Superficie Jardín: 800 m²
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  800
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'garden_surface';

-- Piscina: Privada Infinity
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'Privada Infinity'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'pool_type';

-- Orientación: Sur
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'Sur'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'orientation';

-- Vistas: Mar, Panorámicas
INSERT INTO public.attribute_values (item_id, attribute_id, value_text_array)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  ARRAY['Mar', 'Panorámicas']
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'views';

-- Es Exterior: Sí
INSERT INTO public.attribute_values (item_id, attribute_id, value_boolean)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  true
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'is_exterior';

-- Calefacción: Aerotermia Suelo Radiante
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'Aerotermia Suelo Radiante'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'heating_type';

-- Aire Acondicionado: Conductos Centralizado
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'Conductos Centralizado'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'air_conditioning';

-- Tipo de Cocina: Americana Equipada
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'Americana Equipada'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'kitchen_type';

-- Armarios Empotrados: Sí
INSERT INTO public.attribute_values (item_id, attribute_id, value_boolean)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  true
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'built_in_wardrobes';

-- Certificación Energética: A
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'A'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'energy_certificate';

-- Características Destacadas
INSERT INTO public.attribute_values (item_id, attribute_id, value_text_array)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  ARRAY['Vistas al Mar', 'Piscina Privada', 'Obra Nueva', 'Domótica', 'Placas Solares', 'Jardín Privado', 'Parking Privado', 'Luminoso', 'Exterior', 'Cerca del Mar']
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'features';

-- Suelos: Porcelánico
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'Porcelánico'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'flooring_type';

-- Techos Altos: Sí
INSERT INTO public.attribute_values (item_id, attribute_id, value_boolean)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  true
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'high_ceilings';

-- Altura Techos: 3.2 m
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  3.2
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'ceiling_height';

-- Sistema de Seguridad: Alarma
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'Cámaras de Seguridad'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'security_type';

-- Domótica: Sí
INSERT INTO public.attribute_values (item_id, attribute_id, value_boolean)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  true
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'has_home_automation';

-- Referencia Interna
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  'RM-SITGES-001'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'internal_reference';

-- Propiedad Destacada: Sí
INSERT INTO public.attribute_values (item_id, attribute_id, value_boolean)
SELECT 
  '8f4a9c2e-1b5d-4e3a-9f7c-2d8e5a6b1c3f',
  ad.id,
  true
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'is_featured';

-- =====================================================================================
-- PROPIEDAD 2: PISO REFORMADO EN EL EIXAMPLE DE BARCELONA
-- =====================================================================================

-- Crear el item base
INSERT INTO public.items (id, company_id, title, summary, status, item_type, created_at, updated_at)
VALUES (
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d',
  'Piso de Diseño en Finca Regia del Eixample',
  'Elegante piso completamente reformado de 145 m² en una finca regia modernista. Techos altos, suelos hidráulicos originales y mucha luz natural.',
  'published',
  'property',
  NOW(),
  NOW()
);

-- ATRIBUTOS OBLIGATORIOS

-- 1. Precio: 695,000 EUR
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  695000
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'price';

-- 2. Tipo de Operación: Venta
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'Venta'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'operation_type';

-- 3. Tipo de Propiedad: Piso
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'Piso'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'property_type';

-- 4. Provincia: Barcelona
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'Barcelona'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'province';

-- 5. Ciudad: Barcelona
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'Barcelona'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'city';

-- 6. Zona: Barcelona (obligatorio para filtrado)
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'Barcelona'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'zone';

-- 7. Superficie Construida: 145 m²
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  145
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'built_surface';

-- 8. Habitaciones: 3
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  3
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'bedrooms';

-- 9. Baños: 2
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  2
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'bathrooms';

-- 10. Estado: Reformado
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'Reformado'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'condition';

-- 11. Descripción Completa
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'En el corazón del Eixample Dreta, a pocos metros del Passeig de Sant Joan, descubra este magnífico piso de 145 m² que combina a la perfección la elegancia arquitectónica de una finca modernista de 1906 con las comodidades de una reforma integral de alta calidad.

La propiedad se encuentra en una cuarta planta real de una señorial finca regia con ascensor y portería. La reforma, ejecutada con materiales premium y atención al detalle, ha sabido preservar los elementos arquitectónicos originales más emblemáticos: techos de 3,5 metros de altura con molduras originales, suelos hidráulicos recuperados y restaurados, y ventanas con carpintería de madera noble.

La distribución es óptima: amplio recibidor que distribuye a un luminoso salón-comedor de 40 m² con tres balcones a la calle, cocina office completamente equipada con electrodomésticos Bosch y acceso a galería-lavadero, tres habitaciones dobles (la principal en suite con vestidor), y dos baños completos con acabados en piedra natural y griferías Grohe.

La vivienda está equipada con sistema de climatización mediante splits de bajo consumo en todas las estancias, calefacción por radiadores de diseño, carpintería interior lacada en blanco, armarios empotrados a medida en todas las habitaciones, y domótica para control de iluminación y persianas motorizadas.

Ubicada en una de las zonas más cotizadas de Barcelona, rodeada de la mejor oferta cultural, gastronómica y comercial de la ciudad. Excelente comunicación con transporte público (metro L4 Verdaguer a 3 minutos) y próxima a los principales puntos de interés: Casa Batlló, La Pedrera, y el Passeig de Gràcia.

Incluye opcionalmente una plaza de parking en finca colindante (+35.000€) y un trastero de 8 m² (+15.000€).

Certificación energética D. Gastos de comunidad: 180€/mes. IBI: 1.800€/año.'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'description';

-- ATRIBUTOS OPCIONALES RELEVANTES

-- Superficie Útil: 130 m²
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  130
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'usable_surface';

-- Planta: 4ª Planta
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  '4ª Planta'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'floor';

-- Ascensor: Sí
INSERT INTO public.attribute_values (item_id, attribute_id, value_boolean)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  true
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'has_elevator';

-- Año de Construcción: 1906
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  1906
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'year_built';

-- Parking: Opcional
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'Opcional'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'parking_type';

-- Tiene Balcón: Sí
INSERT INTO public.attribute_values (item_id, attribute_id, value_boolean)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  true
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'has_balcony';

-- Orientación: Este-Oeste
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'Este'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'orientation';

-- Vistas: Ciudad, Calle
INSERT INTO public.attribute_values (item_id, attribute_id, value_text_array)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  ARRAY['Ciudad', 'Calle']
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'views';

-- Es Exterior: Sí
INSERT INTO public.attribute_values (item_id, attribute_id, value_boolean)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  true
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'is_exterior';

-- Calefacción: Radiadores Gas
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'Radiadores Gas'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'heating_type';

-- Aire Acondicionado: Splits
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'Splits'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'air_conditioning';

-- Tipo de Cocina: Office Equipada
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'Office Equipada'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'kitchen_type';

-- Armarios Empotrados: Sí
INSERT INTO public.attribute_values (item_id, attribute_id, value_boolean)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  true
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'built_in_wardrobes';

-- Certificación Energética: D
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'D'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'energy_certificate';

-- Gastos de Comunidad: 180 €/mes
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  180
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'community_fees';

-- Características Destacadas
INSERT INTO public.attribute_values (item_id, attribute_id, value_text_array)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  ARRAY['Reformado', 'Finca Regia', 'Luminoso', 'Exterior', 'Céntrico', 'Bien Comunicado', 'Ascensor', 'Armarios Empotrados', 'Aire Acondicionado', 'Calefacción']
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'features';

-- Suelos: Hidráulicos
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'Hidráulicos'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'flooring_type';

-- Techos Altos: Sí
INSERT INTO public.attribute_values (item_id, attribute_id, value_boolean)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  true
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'high_ceilings';

-- Altura Techos: 3.5 m
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  3.5
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'ceiling_height';

-- Portería: Sí
INSERT INTO public.attribute_values (item_id, attribute_id, value_boolean)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  true
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'has_concierge';

-- Sistema de Seguridad: Puerta Blindada
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'Puerta Blindada'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'security_type';

-- Referencia Interna
INSERT INTO public.attribute_values (item_id, attribute_id, value_text)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  'RM-BCN-EIX-042'
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'internal_reference';

-- IBI Anual: 1800 €
INSERT INTO public.attribute_values (item_id, attribute_id, value_number)
SELECT 
  'b3e7d9a1-5f2c-4b8e-a9d6-3c1e8f4a7b2d',
  ad.id,
  1800
FROM public.attribute_definitions ad
WHERE ad.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' 
  AND ad.item_type = 'property' 
  AND ad.key = 'ibi_annual';

-- =====================================================================================
-- FIN DE LOS INSERTS
-- =====================================================================================

-- Verificar los items creados
SELECT 
  i.id,
  i.title,
  i.status,
  i.item_type,
  COUNT(av.id) as total_attributes
FROM public.items i
LEFT JOIN public.attribute_values av ON av.item_id = i.id
WHERE i.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d'
GROUP BY i.id, i.title, i.status, i.item_type
ORDER BY i.created_at DESC;

-- Verificar atributos filtrables para búsquedas
SELECT 
  i.title,
  av_price.value_number as precio,
  av_zone.value_text as zona,
  av_bedrooms.value_number as habitaciones,
  av_type.value_text as tipo_propiedad
FROM public.items i
LEFT JOIN public.attribute_values av_price ON av_price.item_id = i.id 
  AND av_price.attribute_id = (SELECT id FROM public.attribute_definitions WHERE company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' AND key = 'price')
LEFT JOIN public.attribute_values av_zone ON av_zone.item_id = i.id 
  AND av_zone.attribute_id = (SELECT id FROM public.attribute_definitions WHERE company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' AND key = 'zone')
LEFT JOIN public.attribute_values av_bedrooms ON av_bedrooms.item_id = i.id 
  AND av_bedrooms.attribute_id = (SELECT id FROM public.attribute_definitions WHERE company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' AND key = 'bedrooms')
LEFT JOIN public.attribute_values av_type ON av_type.item_id = i.id 
  AND av_type.attribute_id = (SELECT id FROM public.attribute_definitions WHERE company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d' AND key = 'property_type')
WHERE i.company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d'
ORDER BY av_price.value_number DESC;
