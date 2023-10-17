package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
)

func MatchProjectId(id string) bool {
	return strings.HasPrefix(os.Getenv("DETA_API_KEY"), id)
}

func FileToDriveSavedName(file map[string]interface{}) string {
	hash := file["hash"].(string)
	fragment := strings.Split(file["name"].(string), ".")
	var driveFilename string
	if len(fragment) > 1 {
		driveFilename = fmt.Sprintf("%s.%s", hash, fragment[len(fragment)-1])
	} else {
		driveFilename = hash
	}
	return driveFilename
}

func FolderToAsParentPath(folder map[string]interface{}) string {
	var path string
	parent, ok := folder["parent"]
	if ok && parent != nil {
		path = parent.(string) + "/" + folder["name"].(string)
	} else {
		path = folder["name"].(string)
	}
	return path
}

func randomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

type FileV1 struct {
	Key        string   `json:"key"`
	Access     string   `json:"access"`
	Date       string   `json:"date"`
	Hash       string   `json:"hash"`
	Mime       string   `json:"mime"`
	Name       string   `json:"name"`
	Color      string   `json:"color"`
	Parent     string   `json:"parent"`
	Size       float64  `json:"size"`
	Type       string   `json:"type"`
	Pinned     bool     `json:"pinned"`
	Recipients []string `json:"recipients"`
	Deleted    bool     `json:"deleted"`
}

type AccessToken struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

type FileV2 struct {
	Key           string        `json:"key"`
	Name          string        `json:"name"`
	Color         string        `json:"color"`
	NameLowercase string        `json:"nameLowercase"`
	Folder        bool          `json:"folder"`
	Public        bool          `json:"public"`
	CreatedAt     string        `json:"createdAt"`
	Path          string        `json:"path"`
	Type          string        `json:"type"`
	Owner         string        `json:"owner"`
	Size          float64       `json:"size"`
	Tag           []string      `json:"tag"`
	Partial       bool          `json:"partial"`
	UploadedUpTo  float64       `json:"uploadedUpTo"`
	Deleted       bool          `json:"deleted"`
	AccessTokens  []AccessToken `json:"accessTokens"`
}
