-- MySQL dump 10.13  Distrib 8.4.7, for Win64 (x86_64)
--
-- Host: localhost    Database: schoolbase
-- ------------------------------------------------------
-- Server version	8.4.7

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `announcements`
--

DROP TABLE IF EXISTS `announcements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `announcements` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `class_id` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` date DEFAULT NULL,
  `created_by` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  KEY `class_id` (`class_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `announcements_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `announcements_ibfk_2` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `announcements_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `announcements`
--

LOCK TABLES `announcements` WRITE;
/*!40000 ALTER TABLE `announcements` DISABLE KEYS */;
INSERT INTO `announcements` VALUES ('ANN00001','HARAREPR',NULL,'Winter Term Sports Schedule','All students must participate in athletics sessions on Wednesdays.','2026-08-05','USR00002','2026-07-22 12:05:38');
/*!40000 ALTER TABLE `announcements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asset_categories`
--

DROP TABLE IF EXISTS `asset_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_categories` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color_class` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'text-blue-500 bg-blue-50',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asset_categories`
--

LOCK TABLES `asset_categories` WRITE;
/*!40000 ALTER TABLE `asset_categories` DISABLE KEYS */;
/*!40000 ALTER TABLE `asset_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assets`
--

DROP TABLE IF EXISTS `assets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assets` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'book',
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `serial_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `value` decimal(10,2) DEFAULT '0.00',
  `description` text COLLATE utf8mb4_unicode_ci,
  `metadata` text COLLATE utf8mb4_unicode_ci,
  `status` enum('available','issued','damaged','lost') COLLATE utf8mb4_unicode_ci DEFAULT 'available',
  `holder_id` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `holder_type` enum('student','staff') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  CONSTRAINT `assets_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assets`
--

LOCK TABLES `assets` WRITE;
/*!40000 ALTER TABLE `assets` DISABLE KEYS */;
INSERT INTO `assets` VALUES ('AST00001','HARAREPR','Primary English Coursebook 1A','book','LIB-ENG-1A-001',NULL,0.00,'Standard curriculum book.',NULL,'available',NULL,NULL,'2026-07-22 12:05:38','2026-07-22 12:05:38'),('AST00002','HARAREPR','Grade 1 Maths Kit','equipment','EQP-MTH-G1-02',NULL,0.00,'Fraction blocks and abacus.',NULL,'issued','STD00001','student','2026-07-22 12:05:38','2026-07-22 12:05:38');
/*!40000 ALTER TABLE `assets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance`
--

DROP TABLE IF EXISTS `attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `student_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `class_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `status` enum('present','absent','late','excused') COLLATE utf8mb4_unicode_ci NOT NULL,
  `remarks` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `taken_by` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_attendance_date` (`student_id`,`date`),
  KEY `school_id` (`school_id`),
  KEY `class_id` (`class_id`),
  KEY `taken_by` (`taken_by`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_ibfk_3` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_ibfk_4` FOREIGN KEY (`taken_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance`
--

LOCK TABLES `attendance` WRITE;
/*!40000 ALTER TABLE `attendance` DISABLE KEYS */;
INSERT INTO `attendance` VALUES ('ATT00001','HARAREPR','STD00001','CLS00001','2026-07-22','present',NULL,'USR00003','2026-07-22 12:05:37'),('ATT00002','HARAREPR','STD00002','CLS00001','2026-07-22','present',NULL,'USR00003','2026-07-22 12:05:37');
/*!40000 ALTER TABLE `attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE SET NULL,
  CONSTRAINT `audit_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `classes`
--

DROP TABLE IF EXISTS `classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `classes` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `grade_level` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stream` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  CONSTRAINT `classes_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `classes`
--

LOCK TABLES `classes` WRITE;
/*!40000 ALTER TABLE `classes` DISABLE KEYS */;
INSERT INTO `classes` VALUES ('CLS00001','HARAREPR','Grade 1 Red','Grade 1','Red','2026-07-22 12:05:36'),('CLS00002','HARAREPR','Grade 2 Blue','Grade 2','Blue','2026-07-22 12:05:36'),('CLS00003','HARAREPR','Grade 3 Green','Grade 3','Green','2026-07-22 12:05:36');
/*!40000 ALTER TABLE `classes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `discipline_incidents`
--

DROP TABLE IF EXISTS `discipline_incidents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `discipline_incidents` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `student_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `incident_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('minor','moderate','serious') COLLATE utf8mb4_unicode_ci DEFAULT 'minor',
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_taken` text COLLATE utf8mb4_unicode_ci,
  `incident_date` date NOT NULL,
  `status` enum('open','resolved','escalated') COLLATE utf8mb4_unicode_ci DEFAULT 'open',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  KEY `student_id` (`student_id`),
  CONSTRAINT `discipline_incidents_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `discipline_incidents_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `discipline_incidents`
--

LOCK TABLES `discipline_incidents` WRITE;
/*!40000 ALTER TABLE `discipline_incidents` DISABLE KEYS */;
INSERT INTO `discipline_incidents` VALUES ('DIS00001','HARAREPR','STD00003','Vandalism','moderate','Scratched the wooden desks in Class 2B.','Parent called for meeting; agreed to replace/repair.','2026-07-20','resolved','2026-07-22 12:05:38','2026-07-22 12:05:38');
/*!40000 ALTER TABLE `discipline_incidents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `enquiries`
--

DROP TABLE IF EXISTS `enquiries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `enquiries` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applicant_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `grade_applying_for` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `guardian_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `guardian_phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guardian_email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('new','contacted','tour','offered','enrolled','declined') COLLATE utf8mb4_unicode_ci DEFAULT 'new',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  CONSTRAINT `enquiries_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `enquiries`
--

LOCK TABLES `enquiries` WRITE;
/*!40000 ALTER TABLE `enquiries` DISABLE KEYS */;
INSERT INTO `enquiries` VALUES ('ENQ00001','HARAREPR','Simba Mutasa','Grade 1','Oliver Mutasa','+26377222333','oliver@mutasa.co.zw','Looking for early enrollment discount options.','new','2026-07-22 12:05:38','2026-07-22 12:05:38'),('ENQ00002','HARAREPR','Chiedza Ndlovu','Grade 2','Nomsa Ndlovu','+26377444555','nomsa@ndlovu.co.zw','Transferred from Bulawayo Prep.','contacted','2026-07-22 12:05:38','2026-07-22 12:05:38');
/*!40000 ALTER TABLE `enquiries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `exams`
--

DROP TABLE IF EXISTS `exams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exams` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `class_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `term` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `exam_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time DEFAULT NULL,
  `duration_minutes` int NOT NULL DEFAULT '120',
  `exam_type` enum('test','exam','coursework','mock') COLLATE utf8mb4_unicode_ci DEFAULT 'exam',
  `venue` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `room` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invigilator` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  KEY `class_id` (`class_id`),
  CONSTRAINT `exams_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `exams_ibfk_2` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `exams`
--

LOCK TABLES `exams` WRITE;
/*!40000 ALTER TABLE `exams` DISABLE KEYS */;
INSERT INTO `exams` VALUES ('EXM00001','HARAREPR','CLS00001','2026-T1','English Reading Comprehension','2026-08-01','08:30:00',NULL,90,'exam',NULL,'Hall A','Tinashe Moyo','2026-07-22 12:05:38'),('EXM00002','HARAREPR','CLS00001','2026-T1','Mathematics Assessment','2026-07-25','09:00:00',NULL,60,'exam',NULL,'Room 5','Mrs. Gumbo','2026-07-22 12:05:38');
/*!40000 ALTER TABLE `exams` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fee_payments`
--

DROP TABLE IF EXISTS `fee_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fee_payments` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `student_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fee_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_paid` decimal(10,2) NOT NULL,
  `payment_date` datetime NOT NULL,
  `reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_method` enum('cash','bank_transfer','mobile_money') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'cash',
  `payment_currency` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'USD',
  `exchange_rate` decimal(12,4) DEFAULT '1.0000',
  `amount_in_payment_currency` decimal(12,2) DEFAULT NULL,
  `idempotency_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idempotency_key` (`idempotency_key`),
  KEY `school_id` (`school_id`),
  KEY `student_id` (`student_id`),
  KEY `fee_id` (`fee_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `fee_payments_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fee_payments_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fee_payments_ibfk_3` FOREIGN KEY (`fee_id`) REFERENCES `fees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fee_payments_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fee_payments`
--

LOCK TABLES `fee_payments` WRITE;
/*!40000 ALTER TABLE `fee_payments` DISABLE KEYS */;
INSERT INTO `fee_payments` VALUES ('PAY00001','HARAREPR','STD00001','FEE00001',150.00,'2026-07-22 14:05:37','BANK-PAY-REF-001','bank_transfer','USD',1.0000,150.00,'IDEM-KEY-001','USR00003','2026-07-22 12:05:37'),('PAY00002','HARAREPR','STD00002','FEE00002',150.00,'2026-07-22 14:05:37','BANK-PAY-REF-002','bank_transfer','ZiG',25.0000,3750.00,'IDEM-KEY-002','USR00003','2026-07-22 12:05:37');
/*!40000 ALTER TABLE `fee_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fees`
--

DROP TABLE IF EXISTS `fees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fees` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `student_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `term` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_due` decimal(10,2) NOT NULL,
  `amount_paid` decimal(10,2) DEFAULT '0.00',
  `status` enum('unpaid','partial','cleared') COLLATE utf8mb4_unicode_ci DEFAULT 'unpaid',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_term_fee` (`student_id`,`term`),
  KEY `school_id` (`school_id`),
  CONSTRAINT `fees_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fees_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fees`
--

LOCK TABLES `fees` WRITE;
/*!40000 ALTER TABLE `fees` DISABLE KEYS */;
INSERT INTO `fees` VALUES ('FEE00001','HARAREPR','STD00001','2026-T1',500.00,150.00,'partial','2026-07-22 12:05:37'),('FEE00002','HARAREPR','STD00002','2026-T1',500.00,150.00,'partial','2026-07-22 12:05:37');
/*!40000 ALTER TABLE `fees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `grade_thresholds`
--

DROP TABLE IF EXISTS `grade_thresholds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grade_thresholds` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `grade_symbol` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL,
  `min_mark` decimal(5,2) NOT NULL,
  `max_mark` decimal(5,2) NOT NULL,
  `is_pass` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  CONSTRAINT `grade_thresholds_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grade_thresholds`
--

LOCK TABLES `grade_thresholds` WRITE;
/*!40000 ALTER TABLE `grade_thresholds` DISABLE KEYS */;
/*!40000 ALTER TABLE `grade_thresholds` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `grades`
--

DROP TABLE IF EXISTS `grades`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grades` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `student_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `class_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `term` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `grade_value` decimal(5,2) NOT NULL,
  `assessment_type` enum('test','exam','coursework') COLLATE utf8mb4_unicode_ci NOT NULL,
  `assessment_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Test 1',
  `weight` decimal(3,2) DEFAULT '1.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  KEY `student_id` (`student_id`),
  KEY `class_id` (`class_id`),
  CONSTRAINT `grades_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `grades_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `grades_ibfk_3` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grades`
--

LOCK TABLES `grades` WRITE;
/*!40000 ALTER TABLE `grades` DISABLE KEYS */;
INSERT INTO `grades` VALUES ('GRD00001','HARAREPR','STD00001','CLS00001','Mathematics','2026-T1',85.00,'test','Test 1',1.00,'2026-07-22 12:05:37'),('GRD00002','HARAREPR','STD00001','CLS00001','Mathematics','2026-T1',91.00,'test','Test 2',1.00,'2026-07-22 12:05:37'),('GRD00003','HARAREPR','STD00001','CLS00001','Mathematics','2026-T1',88.00,'exam','Final Exam',1.00,'2026-07-22 12:05:37'),('GRD00004','HARAREPR','STD00001','CLS00001','English','2026-T1',92.50,'exam','Final Exam',1.00,'2026-07-22 12:05:37'),('GRD00005','HARAREPR','STD00001','CLS00001','Shona','2026-T1',74.00,'exam','Final Exam',1.00,'2026-07-22 12:05:37'),('GRD00006','HARAREPR','STD00002','CLS00001','Mathematics','2026-T1',60.00,'test','Test 1',1.00,'2026-07-22 12:05:38'),('GRD00007','HARAREPR','STD00002','CLS00001','Mathematics','2026-T1',64.00,'test','Test 2',1.00,'2026-07-22 12:05:38'),('GRD00008','HARAREPR','STD00002','CLS00001','Mathematics','2026-T1',62.00,'exam','Final Exam',1.00,'2026-07-22 12:05:38'),('GRD00009','HARAREPR','STD00002','CLS00001','English','2026-T1',78.00,'exam','Final Exam',1.00,'2026-07-22 12:05:38'),('GRD00010','HARAREPR','STD00002','CLS00001','Shona','2026-T1',85.00,'exam','Final Exam',1.00,'2026-07-22 12:05:38'),('GRD00011','HARAREPR','STD00003','CLS00002','Mathematics','2026-T1',45.00,'exam','Final Exam',1.00,'2026-07-22 12:05:38'),('GRD00012','HARAREPR','STD00003','CLS00002','English','2026-T1',52.00,'exam','Final Exam',1.00,'2026-07-22 12:05:38'),('GRD00013','HARAREPR','STD00003','CLS00002','Shona','2026-T1',61.00,'exam','Final Exam',1.00,'2026-07-22 12:05:38'),('GRD00014','HARAREPR','STD00004','CLS00003','Mathematics','2026-T1',95.00,'exam','Final Exam',1.00,'2026-07-22 12:05:38'),('GRD00015','HARAREPR','STD00004','CLS00003','English','2026-T1',89.00,'exam','Final Exam',1.00,'2026-07-22 12:05:38'),('GRD00016','HARAREPR','STD00004','CLS00003','Shona','2026-T1',90.00,'exam','Final Exam',1.00,'2026-07-22 12:05:38');
/*!40000 ALTER TABLE `grades` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `guardians`
--

DROP TABLE IF EXISTS `guardians`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `guardians` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `national_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `relation` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `guardians_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `guardians_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `guardians`
--

LOCK TABLES `guardians` WRITE;
/*!40000 ALTER TABLE `guardians` DISABLE KEYS */;
INSERT INTO `guardians` VALUES ('GDN00001','HARAREPR','USR00004',NULL,'Farai Chigumba','+26377333444','guardian@harareprep.co.zw','Father','2026-07-22 12:05:37');
/*!40000 ALTER TABLE `guardians` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leave_requests`
--

DROP TABLE IF EXISTS `leave_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_requests` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `request_type` enum('student_absence','staff_leave','exeat_pass') COLLATE utf8mb4_unicode_ci NOT NULL,
  `student_id` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `staff_id` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hostel_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `reviewed_by` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewer_comment` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  KEY `student_id` (`student_id`),
  KEY `staff_id` (`staff_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `leave_requests_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leave_requests_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE SET NULL,
  CONSTRAINT `leave_requests_ibfk_3` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`) ON DELETE SET NULL,
  CONSTRAINT `leave_requests_ibfk_4` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leave_requests`
--

LOCK TABLES `leave_requests` WRITE;
/*!40000 ALTER TABLE `leave_requests` DISABLE KEYS */;
INSERT INTO `leave_requests` VALUES ('LVR00001','HARAREPR','student_absence','STD00001',NULL,NULL,'USR00004','2026-07-20','2026-07-22','Family bereavement and funeral service attendance in Mutare.','pending',NULL,NULL,'2026-07-22 12:05:38'),('LVR00002','HARAREPR','staff_leave',NULL,'STF00001',NULL,'USR00003','2026-08-01','2026-08-05','Scheduled dental surgery procedure and recovery leave.','approved','USR00002','Approved with medical cert provision.','2026-07-22 12:05:38'),('LVR00003','HARAREPR','exeat_pass','STD00001',NULL,'Falcon House','USR00004','2026-07-25','2026-07-27','Weekend visit home to Harare for family reunion exeat.','approved','USR00002','Approved by hostel master.','2026-07-22 12:05:38');
/*!40000 ALTER TABLE `leave_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `licenses`
--

DROP TABLE IF EXISTS `licenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `licenses` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `license_key` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `plan` enum('basic','full') COLLATE utf8mb4_unicode_ci DEFAULT 'basic',
  `status` enum('active','suspended','expired') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `issued_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  `max_users` int DEFAULT '100',
  `issued_by` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  KEY `issued_by` (`issued_by`),
  CONSTRAINT `licenses_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `licenses_ibfk_2` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `licenses`
--

LOCK TABLES `licenses` WRITE;
/*!40000 ALTER TABLE `licenses` DISABLE KEYS */;
INSERT INTO `licenses` VALUES ('LIC00001','HARAREPR','eyJzY2hvb2xfaWQiOiJIQVJBUkVQUiIsInBsYW4iOiJmdWxsIiwiZXhwaXJlc19hdCI6IjIwMjYtMDctMzEifQ==','full','active','2026-07-22 12:05:36','2027-12-31 22:00:00',0,'USR00001');
/*!40000 ALTER TABLE `licenses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `login_rate_limit`
--

DROP TABLE IF EXISTS `login_rate_limit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_rate_limit` (
  `ip` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` int unsigned NOT NULL DEFAULT '1',
  `window_start` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `login_rate_limit`
--

LOCK TABLES `login_rate_limit` WRITE;
/*!40000 ALTER TABLE `login_rate_limit` DISABLE KEYS */;
/*!40000 ALTER TABLE `login_rate_limit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_settings`
--

DROP TABLE IF EXISTS `notification_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_settings` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sms_gateway_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sms_api_key` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sms_sender_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_smtp_host` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_smtp_port` int DEFAULT '587',
  `email_smtp_user` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_smtp_pass` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_from_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_from_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_gateway_type` enum('ecocash','paynow','innbucks','mukuru','bank_transfer','mock') COLLATE utf8mb4_unicode_ci DEFAULT 'mock',
  `payment_merchant_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_merchant_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_api_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notify_attendance_absent` tinyint(1) DEFAULT '1',
  `notify_results_published` tinyint(1) DEFAULT '1',
  `notify_fees_overdue` tinyint(1) DEFAULT '1',
  `notify_discipline_incident` tinyint(1) DEFAULT '1',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `school_id` (`school_id`),
  CONSTRAINT `notification_settings_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_settings`
--

LOCK TABLES `notification_settings` WRITE;
/*!40000 ALTER TABLE `notification_settings` DISABLE KEYS */;
INSERT INTO `notification_settings` VALUES ('NTS00001','HARAREPR','http://localhost/mock-sms-gateway','mock-api-key-12345','HararePrep',NULL,587,NULL,NULL,NULL,NULL,'mock',NULL,NULL,NULL,1,1,1,1,'2026-07-22 12:05:38');
/*!40000 ALTER TABLE `notification_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `password_reset_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `remote_payments`
--

DROP TABLE IF EXISTS `remote_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `remote_payments` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `student_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `guardian_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_date` date NOT NULL,
  `payment_method` enum('bank_transfer','mobile_money') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `rejection_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `reference` (`reference`),
  KEY `idx_remote_payments_ref` (`school_id`,`reference`),
  KEY `student_id` (`student_id`),
  KEY `guardian_id` (`guardian_id`),
  CONSTRAINT `remote_payments_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `remote_payments_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `remote_payments_ibfk_3` FOREIGN KEY (`guardian_id`) REFERENCES `guardians` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `remote_payments`
--

LOCK TABLES `remote_payments` WRITE;
/*!40000 ALTER TABLE `remote_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `remote_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `report_comments`
--

DROP TABLE IF EXISTS `report_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_comments` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `report_type` enum('attendance','grades','exam','discipline','fee','general') COLLATE utf8mb4_unicode_ci NOT NULL,
  `ref_id` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ref_date` date DEFAULT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `report_comments_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `report_comments_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `report_comments`
--

LOCK TABLES `report_comments` WRITE;
/*!40000 ALTER TABLE `report_comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `report_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `results`
--

DROP TABLE IF EXISTS `results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `results` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `student_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `class_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `term` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `overall_percentage` decimal(5,2) NOT NULL,
  `grade` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rank` int DEFAULT NULL,
  `pass_status` enum('pass','fail') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('locked','published') COLLATE utf8mb4_unicode_ci DEFAULT 'locked',
  `computed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_term_result` (`student_id`,`term`),
  KEY `school_id` (`school_id`),
  KEY `class_id` (`class_id`),
  CONSTRAINT `results_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `results_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `results_ibfk_3` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `results`
--

LOCK TABLES `results` WRITE;
/*!40000 ALTER TABLE `results` DISABLE KEYS */;
/*!40000 ALTER TABLE `results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schools`
--

DROP TABLE IF EXISTS `schools`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schools` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','suspended','expired') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `school_type` enum('primary','secondary') COLLATE utf8mb4_unicode_ci DEFAULT 'primary',
  `tuition_fee_benchmark` decimal(10,2) DEFAULT '500.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schools`
--

LOCK TABLES `schools` WRITE;
/*!40000 ALTER TABLE `schools` DISABLE KEYS */;
INSERT INTO `schools` VALUES ('HARAREPR','Harare Primary School','HARARE-PREP-01','active','primary',500.00,'2026-07-22 12:05:35','2026-07-22 12:05:35');
/*!40000 ALTER TABLE `schools` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `staff`
--

DROP TABLE IF EXISTS `staff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `class_id` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role_title` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  KEY `user_id` (`user_id`),
  KEY `class_id` (`class_id`),
  CONSTRAINT `staff_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `staff_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `staff_ibfk_3` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff`
--

LOCK TABLES `staff` WRITE;
/*!40000 ALTER TABLE `staff` DISABLE KEYS */;
INSERT INTO `staff` VALUES ('STF00001','HARAREPR','USR00003','CLS00001','Tinashe Moyo','teacher@harareprep.co.zw','+26377111222','Grade 1 Teacher','2026-07-22 12:05:36');
/*!40000 ALTER TABLE `staff` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_guardians`
--

DROP TABLE IF EXISTS `student_guardians`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_guardians` (
  `student_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `guardian_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `relation` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`student_id`,`guardian_id`),
  KEY `guardian_id` (`guardian_id`),
  CONSTRAINT `student_guardians_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `student_guardians_ibfk_2` FOREIGN KEY (`guardian_id`) REFERENCES `guardians` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_guardians`
--

LOCK TABLES `student_guardians` WRITE;
/*!40000 ALTER TABLE `student_guardians` DISABLE KEYS */;
INSERT INTO `student_guardians` VALUES ('STD00001','GDN00001',NULL);
/*!40000 ALTER TABLE `student_guardians` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_health`
--

DROP TABLE IF EXISTS `student_health`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_health` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `student_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `blood_group` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `allergies` text COLLATE utf8mb4_unicode_ci,
  `medical_conditions` text COLLATE utf8mb4_unicode_ci,
  `emergency_contact_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergency_contact_phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confidential_notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_id` (`student_id`),
  KEY `school_id` (`school_id`),
  CONSTRAINT `student_health_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `student_health_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_health`
--

LOCK TABLES `student_health` WRITE;
/*!40000 ALTER TABLE `student_health` DISABLE KEYS */;
INSERT INTO `student_health` VALUES ('HLT00001','HARAREPR','STD00001','O+','Peanut allergy','Mild seasonal asthma.','Farai Chigumba','+26377333444','Requires inhaler during heavy sports sessions.','2026-07-22 12:05:38','2026-07-22 12:05:38');
/*!40000 ALTER TABLE `student_health` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `students` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `class_id` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `admission_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `middle_name` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_of_birth` date NOT NULL,
  `gender` enum('male','female','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('enrolled','suspended','withdrawn','graduated','transferred','dropped_out') COLLATE utf8mb4_unicode_ci DEFAULT 'enrolled',
  `nationality` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `home_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `religion` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `previous_school` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `medical_notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `school_student_admission` (`school_id`,`admission_number`),
  KEY `class_id` (`class_id`),
  CONSTRAINT `students_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `students_ibfk_2` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `students`
--

LOCK TABLES `students` WRITE;
/*!40000 ALTER TABLE `students` DISABLE KEYS */;
INSERT INTO `students` VALUES ('STD00001','HARAREPR','CLS00001','2026-0001','Rufaro','Chigumba',NULL,'2019-05-12','female','enrolled',NULL,NULL,NULL,NULL,NULL,'2026-07-22 12:05:37'),('STD00002','HARAREPR','CLS00001','2026-0002','Kundai','Mashiri',NULL,'2019-08-22','male','enrolled',NULL,NULL,NULL,NULL,NULL,'2026-07-22 12:05:37'),('STD00003','HARAREPR','CLS00002','2026-0003','Tendai','Nyoni',NULL,'2018-02-14','male','enrolled',NULL,NULL,NULL,NULL,NULL,'2026-07-22 12:05:37'),('STD00004','HARAREPR','CLS00003','2026-0004','Chipo','Sibanda',NULL,'2017-11-30','female','enrolled',NULL,NULL,NULL,NULL,NULL,'2026-07-22 12:05:37'),('STD00005','HARAREPR','CLS00001','2026-0005','Tinashe','Mutasa',NULL,'2019-03-10','male','transferred',NULL,NULL,NULL,NULL,NULL,'2026-07-22 12:05:37'),('STD00006','HARAREPR','CLS00001','2026-0006','Tariro','Ndlovu',NULL,'2019-04-18','female','dropped_out',NULL,NULL,NULL,NULL,NULL,'2026-07-22 12:05:37');
/*!40000 ALTER TABLE `students` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subjects`
--

DROP TABLE IF EXISTS `subjects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subjects` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `level` enum('primary','secondary','all') COLLATE utf8mb4_unicode_ci DEFAULT 'all',
  `category` enum('general','arts','commercials','sciences') COLLATE utf8mb4_unicode_ci DEFAULT 'general',
  `is_active` tinyint(1) DEFAULT '1',
  `created_by` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `code` (`code`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `subjects_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subjects`
--

LOCK TABLES `subjects` WRITE;
/*!40000 ALTER TABLE `subjects` DISABLE KEYS */;
INSERT INTO `subjects` VALUES ('SUB00001','Mathematics','MTH','all','general',1,'USR00001','2026-07-22 12:05:36'),('SUB00002','English','ENG','all','general',1,'USR00001','2026-07-22 12:05:36'),('SUB00003','Shona','SHN','all','general',1,'USR00001','2026-07-22 12:05:36'),('SUB00004','Ndebele','NDB','all','general',1,'USR00001','2026-07-22 12:05:36'),('SUB00005','Combined Science','SCI','secondary','general',1,'USR00001','2026-07-22 12:05:36'),('SUB00006','History','HST','secondary','general',1,'USR00001','2026-07-22 12:05:36'),('SUB00007','Literature in English','LIT','secondary','arts',1,'USR00001','2026-07-22 12:05:36'),('SUB00008','Divinity','DIV','secondary','arts',1,'USR00001','2026-07-22 12:05:36'),('SUB00009','Accounts','ACC','secondary','commercials',1,'USR00001','2026-07-22 12:05:36'),('SUB00010','Economics','ECO','secondary','commercials',1,'USR00001','2026-07-22 12:05:36'),('SUB00011','Physics','PHY','secondary','sciences',1,'USR00001','2026-07-22 12:05:36'),('SUB00012','Chemistry','CHM','secondary','sciences',1,'USR00001','2026-07-22 12:05:36'),('SUB00013','Biology','BIO','secondary','sciences',1,'USR00001','2026-07-22 12:05:36');
/*!40000 ALTER TABLE `subjects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_config`
--

DROP TABLE IF EXISTS `system_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_config` (
  `key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_config`
--

LOCK TABLES `system_config` WRITE;
/*!40000 ALTER TABLE `system_config` DISABLE KEYS */;
/*!40000 ALTER TABLE `system_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_events`
--

DROP TABLE IF EXISTS `system_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_events` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `severity` enum('info','warning','critical') COLLATE utf8mb4_unicode_ci DEFAULT 'info',
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  CONSTRAINT `system_events_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_events`
--

LOCK TABLES `system_events` WRITE;
/*!40000 ALTER TABLE `system_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `system_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tasks`
--

DROP TABLE IF EXISTS `tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tasks` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `teacher_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `class_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `due_date` date NOT NULL,
  `status` enum('planned','done','overdue') COLLATE utf8mb4_unicode_ci DEFAULT 'planned',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  KEY `teacher_id` (`teacher_id`),
  KEY `class_id` (`class_id`),
  KEY `subject_id` (`subject_id`),
  CONSTRAINT `tasks_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tasks_ibfk_2` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tasks_ibfk_3` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tasks_ibfk_4` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tasks`
--

LOCK TABLES `tasks` WRITE;
/*!40000 ALTER TABLE `tasks` DISABLE KEYS */;
INSERT INTO `tasks` VALUES ('TSK00001','HARAREPR','USR00003','CLS00001','SUB00001','Algebra Quiz Prep','Prepare sample equations for math quiz next week','2026-07-25','planned','2026-07-22 12:05:37','2026-07-22 12:05:37'),('TSK00002','HARAREPR','USR00003','CLS00002','SUB00002','Grammar Check','Review reading progress of class B','2026-07-21','planned','2026-07-22 12:05:37','2026-07-22 12:05:37'),('TSK00003','HARAREPR','USR00003','CLS00001','SUB00001','Lesson Outline','Outline basic fraction operations','2026-07-17','done','2026-07-22 12:05:37','2026-07-22 12:05:37');
/*!40000 ALTER TABLE `tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teacher_messages`
--

DROP TABLE IF EXISTS `teacher_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teacher_messages` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sender_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_id` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `sent_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  KEY `sender_id` (`sender_id`),
  CONSTRAINT `teacher_messages_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `teacher_messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teacher_messages`
--

LOCK TABLES `teacher_messages` WRITE;
/*!40000 ALTER TABLE `teacher_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `teacher_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teaching_assignments`
--

DROP TABLE IF EXISTS `teaching_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teaching_assignments` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `teacher_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `class_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `teacher_class_subject` (`teacher_id`,`class_id`,`subject_id`),
  KEY `school_id` (`school_id`),
  KEY `class_id` (`class_id`),
  KEY `subject_id` (`subject_id`),
  CONSTRAINT `teaching_assignments_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `teaching_assignments_ibfk_2` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `teaching_assignments_ibfk_3` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `teaching_assignments_ibfk_4` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teaching_assignments`
--

LOCK TABLES `teaching_assignments` WRITE;
/*!40000 ALTER TABLE `teaching_assignments` DISABLE KEYS */;
INSERT INTO `teaching_assignments` VALUES ('TCH00001','HARAREPR','USR00003','CLS00001','SUB00001','2026-07-22 12:05:37'),('TCH00002','HARAREPR','USR00003','CLS00002','SUB00002','2026-07-22 12:05:37');
/*!40000 ALTER TABLE `teaching_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `term_config`
--

DROP TABLE IF EXISTS `term_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `term_config` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `term_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `term_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `is_current` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `school_term` (`school_id`,`term_code`),
  CONSTRAINT `term_config_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `term_config`
--

LOCK TABLES `term_config` WRITE;
/*!40000 ALTER TABLE `term_config` DISABLE KEYS */;
/*!40000 ALTER TABLE `term_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `timetable`
--

DROP TABLE IF EXISTS `timetable`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `timetable` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `class_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `day` enum('Monday','Tuesday','Wednesday','Thursday','Friday') COLLATE utf8mb4_unicode_ci NOT NULL,
  `period` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `teacher` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `class_day_period` (`class_id`,`day`,`period`),
  KEY `school_id` (`school_id`),
  CONSTRAINT `timetable_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `timetable_ibfk_2` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `timetable`
--

LOCK TABLES `timetable` WRITE;
/*!40000 ALTER TABLE `timetable` DISABLE KEYS */;
INSERT INTO `timetable` VALUES ('TTB00001','HARAREPR','CLS00001','Monday','08:00-09:00','Mathematics','Tinashe Moyo','2026-07-22 12:05:38','2026-07-22 12:05:38'),('TTB00002','HARAREPR','CLS00001','Monday','09:00-10:00','English Reading','Tinashe Moyo','2026-07-22 12:05:38','2026-07-22 12:05:38'),('TTB00003','HARAREPR','CLS00001','Tuesday','08:00-09:00','Shona Culture','Mrs. Gumbo','2026-07-22 12:05:38','2026-07-22 12:05:38');
/*!40000 ALTER TABLE `timetable` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_notifications`
--

DROP TABLE IF EXISTS `user_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_notifications` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_notifications_read` (`user_id`,`is_read`),
  KEY `school_id` (`school_id`),
  CONSTRAINT `user_notifications_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_notifications_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_notifications`
--

LOCK TABLES `user_notifications` WRITE;
/*!40000 ALTER TABLE `user_notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `school_id` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('super_admin','school_admin','teacher','parent') COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','deactivated') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `login_attempts` int DEFAULT '0',
  `lockout_until` timestamp NULL DEFAULT NULL,
  `token_version` int DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `school_id` (`school_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('USR00001',NULL,'superadmin','$2y$10$Ex2Ny8vb3tiVwXdCPJKE0ebXa06R6jNalXPrjnAktSP0vtoY9DrTu','super_admin','super@schoolbase.co.zw','active',0,NULL,1,'2026-07-22 12:05:36','2026-07-22 12:05:36'),('USR00002','HARAREPR','schooladmin','$2y$10$KQzPcODz5oCq26SEU6MhdO6gIj4tDrIV9M5EmjEjEsT2mCSmKiSxm','school_admin','admin@harareprep.co.zw','active',0,NULL,1,'2026-07-22 12:05:36','2026-07-22 12:05:36'),('USR00003','HARAREPR','teacher','$2y$10$LzWml1uz7hsGEbvTMro.iO8ICnjHC0JEL0dCcUdLgbhwotOWU4BOG','teacher','teacher@harareprep.co.zw','active',0,NULL,1,'2026-07-22 12:05:36','2026-07-22 12:05:36'),('USR00004','HARAREPR','parent','$2y$10$j.h3L/AFwjyJyQXZ9CvyEe6NR4qpXrf.6D808enDhapW/sAwKi9mS','parent','guardian@harareprep.co.zw','active',0,NULL,1,'2026-07-22 12:05:36','2026-07-22 12:05:36');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-22 14:10:23
