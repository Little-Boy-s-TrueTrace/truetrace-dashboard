package store

import (
	"dashboard/backend/models"
	"database/sql"
	"encoding/json"
	"log"
)

func CreateTables() error {
	// Skip creating tables as they are managed by Spring Boot Hibernate
	return nil
}

func SaveAmlAlert(alert *models.AmlAlert) error {
	if !UsePostgres {
		return nil
	}

	invAcc, _ := json.Marshal(alert.InvolvedAccounts)
	txChain, _ := json.Marshal(alert.TransactionChain)
	graph, _ := json.Marshal(alert.GraphData)

	_, err := SQL.Exec(`
		INSERT INTO aml_alerts(alert_id, trigger_transaction_id, primary_account_number, alert_type, status, risk_score, total_amount, currency, time_window_seconds, involved_accounts_json, transaction_chain_json, graph_data_json, created_at)
		VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (alert_id) DO UPDATE SET status = EXCLUDED.status
	`, alert.AlertID, alert.TriggerTransactionID, alert.PrimaryAccountNumber, alert.AlertType, alert.Status, alert.RiskScore, alert.TotalAmount, alert.Currency, alert.TimeWindowSeconds, string(invAcc), string(txChain), string(graph), alert.CreatedAt)
	if err != nil {
		log.Printf("[Persistence] Failed to save AML alert %s: %v", alert.AlertID, err)
	}
	return err
}

func SaveKycSession(session *models.KycSession) error {
	if !UsePostgres {
		return nil
	}

	_, err := SQL.Exec(`
		INSERT INTO kyc_sessions(session_id, customer_id, customer_name, status, deepfake_score, face_match_score, document_integrity_score, liveness_score, cccd_number, cccd_valid, risk_level, recommended_action, created_at)
		VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (session_id) DO UPDATE SET status = EXCLUDED.status, risk_level = EXCLUDED.risk_level
	`, session.SessionID, session.CustomerID, session.CustomerName, session.Status, int(session.DeepfakeScore*100), int(session.FaceMatchScore*100), int(session.DocumentIntegrityScore*100), int(session.LivenessScore*100), session.CCCDNumber, session.CCCDValid, session.RiskLevel, session.RecommendedAction, session.CreatedAt)
	if err != nil {
		log.Printf("[Persistence] Failed to save KYC session %s: %v", session.SessionID, err)
	}
	return err
}

func SaveStrReport(report *models.StrReport) error {
	if !UsePostgres {
		return nil
	}

	_, err := SQL.Exec(`
		INSERT INTO str_reports(report_id, report_type, status, subject_full_name, subject_cccd_number, total_amount, currency, risk_level, risk_score, narrative_text_vi, narrative_text_en, generated_at)
		VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (report_id) DO UPDATE SET status = EXCLUDED.status
	`, report.ReportID, report.ReportType, report.Status, report.SubjectFullName, report.SubjectCCCDNumber, report.TotalAmount, report.Currency, report.RiskLevel, report.RiskScore, report.NarrativeTextVi, report.NarrativeTextEn, report.GeneratedAt)
	if err != nil {
		log.Printf("[Persistence] Failed to save STR report %s: %v", report.ReportID, err)
	}
	return err
}

func LoadAllFromDB() error {
	if !UsePostgres {
		return nil
	}

	DB.Mu.Lock()
	defer DB.Mu.Unlock()

	// Load aml_alerts
	amlRows, err := SQL.Query(`SELECT id, alert_id, COALESCE(trigger_transaction_id,''), COALESCE(primary_account_number,''), COALESCE(alert_type,''), COALESCE(status,'OPEN'), COALESCE(risk_score,0), COALESCE(total_amount,0), COALESCE(currency,'VND'), COALESCE(time_window_seconds,0), involved_accounts_json, transaction_chain_json, graph_data_json, created_at, resolved_at, COALESCE(resolved_by,'') FROM aml_alerts ORDER BY created_at DESC`)
	if err != nil {
		log.Printf("[Persistence] Failed to load AML alerts: %v", err)
	} else {
		DB.AmlAlerts = make([]*models.AmlAlert, 0)
		for amlRows.Next() {
			var a models.AmlAlert
			var invAcc, txChain, graph sql.NullString
			err := amlRows.Scan(&a.ID, &a.AlertID, &a.TriggerTransactionID, &a.PrimaryAccountNumber, &a.AlertType, &a.Status, &a.RiskScore, &a.TotalAmount, &a.Currency, &a.TimeWindowSeconds, &invAcc, &txChain, &graph, &a.CreatedAt, &a.ResolvedAt, &a.ResolvedBy)
			if err != nil {
				log.Printf("[Persistence] Error scanning AML alert row: %v", err)
				continue
			}
			if invAcc.Valid {
				json.Unmarshal([]byte(invAcc.String), &a.InvolvedAccounts)
			}
			if txChain.Valid {
				json.Unmarshal([]byte(txChain.String), &a.TransactionChain)
			}
			if graph.Valid {
				json.Unmarshal([]byte(graph.String), &a.GraphData)
			}
			DB.AmlAlerts = append(DB.AmlAlerts, &a)
		}
		amlRows.Close()
		log.Printf("[Persistence] Loaded %d AML alerts from DB", len(DB.AmlAlerts))
	}

	// Load kyc_sessions
	kycRows, err := SQL.Query(`SELECT id, session_id, COALESCE(customer_id,''), COALESCE(customer_name,''), COALESCE(status,'PENDING'), COALESCE(deepfake_score,0), COALESCE(face_match_score,0), COALESCE(document_integrity_score,0), COALESCE(liveness_score,0), COALESCE(cccd_number,''), COALESCE(cccd_valid,false), COALESCE(risk_level,'pending'), COALESCE(recommended_action,'manual_review'), created_at, COALESCE(reviewed_by,'') FROM kyc_sessions ORDER BY created_at DESC`)
	if err != nil {
		log.Printf("[Persistence] Failed to load KYC sessions: %v", err)
	} else {
		DB.KycSessions = make([]*models.KycSession, 0)
		for kycRows.Next() {
			var s models.KycSession
			var ds, fs, dis, ls int
			err := kycRows.Scan(&s.ID, &s.SessionID, &s.CustomerID, &s.CustomerName, &s.Status, &ds, &fs, &dis, &ls, &s.CCCDNumber, &s.CCCDValid, &s.RiskLevel, &s.RecommendedAction, &s.CreatedAt, &s.ReviewedBy)
			if err != nil {
				log.Printf("[Persistence] Error scanning KYC session row: %v", err)
				continue
			}
			s.DeepfakeScore = float64(ds) / 100.0
			s.FaceMatchScore = float64(fs) / 100.0
			s.DocumentIntegrityScore = float64(dis) / 100.0
			s.LivenessScore = float64(ls) / 100.0
			DB.KycSessions = append(DB.KycSessions, &s)
		}
		kycRows.Close()
		log.Printf("[Persistence] Loaded %d KYC sessions from DB", len(DB.KycSessions))
	}

	// Load str_reports
	strRows, err := SQL.Query(`SELECT id, report_id, COALESCE(report_type,'STR'), COALESCE(status,'DRAFT'), COALESCE(subject_full_name,''), COALESCE(subject_cccd_number,''), COALESCE(total_amount,0), COALESCE(currency,'VND'), COALESCE(risk_level,''), COALESCE(risk_score,0), COALESCE(narrative_text_vi,''), COALESCE(narrative_text_en,''), generated_at, submitted_at FROM str_reports ORDER BY generated_at DESC`)
	if err != nil {
		log.Printf("[Persistence] Failed to load STR reports: %v", err)
	} else {
		DB.StrReports = make([]*models.StrReport, 0)
		for strRows.Next() {
			var r models.StrReport
			err := strRows.Scan(&r.ID, &r.ReportID, &r.ReportType, &r.Status, &r.SubjectFullName, &r.SubjectCCCDNumber, &r.TotalAmount, &r.Currency, &r.RiskLevel, &r.RiskScore, &r.NarrativeTextVi, &r.NarrativeTextEn, &r.GeneratedAt, &r.SubmittedAt)
			if err != nil {
				log.Printf("[Persistence] Error scanning STR report row: %v", err)
				continue
			}
			DB.StrReports = append(DB.StrReports, &r)
		}
		strRows.Close()
		log.Printf("[Persistence] Loaded %d STR reports from DB", len(DB.StrReports))
	}

	return nil
}
