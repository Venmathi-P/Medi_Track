-- MediTrack MySQL schema (optional: the backend also creates these tables on startup)
CREATE DATABASE IF NOT EXISTS meditrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE meditrack;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ix_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS medicines (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT NOT NULL,
  name                VARCHAR(150) NOT NULL,
  dosage              VARCHAR(100) NOT NULL,
  frequency           VARCHAR(100) NOT NULL,
  quantity            INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 10,
  start_date          DATE NOT NULL,
  expiry_date         DATE NOT NULL,
  notes               TEXT NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_medicines_user_id (user_id),
  CONSTRAINT fk_medicines_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reminders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  medicine_id INT NOT NULL,
  remind_time TIME NOT NULL,
  start_date  DATE NOT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reminder_med_time (medicine_id, remind_time),
  KEY ix_reminders_user_id (user_id),
  CONSTRAINT fk_reminders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reminders_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dose_logs (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  reminder_id    INT NOT NULL,
  medicine_id    INT NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  status         VARCHAR(10) NOT NULL DEFAULT 'Pending',  -- Pending | Taken | Skipped
  acted_at       DATETIME NULL,
  UNIQUE KEY uq_dose_reminder_day (reminder_id, scheduled_date),
  KEY ix_dose_logs_user_id (user_id),
  KEY ix_dose_logs_date (scheduled_date),
  CONSTRAINT fk_dose_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_dose_reminder FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE,
  CONSTRAINT fk_dose_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prescriptions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  user_id           INT NOT NULL,
  title             VARCHAR(150) NOT NULL,
  doctor_name       VARCHAR(150) NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename   VARCHAR(100) NOT NULL,
  content_type      VARCHAR(100) NOT NULL,
  size_bytes        INT NOT NULL,
  uploaded_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_prescription_file (stored_filename),
  KEY ix_prescriptions_user_id (user_id),
  CONSTRAINT fk_prescriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS emergency_profiles (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  token         VARCHAR(64) NOT NULL,
  is_enabled    TINYINT(1) NOT NULL DEFAULT 0,
  blood_group   VARCHAR(5) NULL,
  allergies     TEXT NULL,
  conditions    TEXT NULL,
  contact_name  VARCHAR(100) NULL,
  contact_phone VARCHAR(30) NULL,
  notes         TEXT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_emergency_user (user_id),
  UNIQUE KEY ix_emergency_token (token),
  CONSTRAINT fk_emergency_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prescription_files (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  prescription_id INT NOT NULL,
  data            LONGBLOB NOT NULL,
  UNIQUE KEY uq_prescription_file (prescription_id),
  CONSTRAINT fk_pfile_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB;
