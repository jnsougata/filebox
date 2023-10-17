package main

import (
	"backend/deta"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"regexp"
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

func buildFolderQuery(name string, parent interface{}) *deta.Query {
	q := deta.NewQuery()
	q.Limit = 1
	q.Equals("name", name)
	q.Equals("parent", parent)
	q.Equals("type", "folder")
	return q
}

func buildPathV2FromV1(parent string) (string, error) {
	if parent == "" {
		return "/", nil
	}
	var path string
	expr, _ := regexp.Compile(`[^/]+`)
	matches := expr.FindAllString(parent, -1)
	rootFolder := matches[0]
	resp := base.Fetch(buildFolderQuery(rootFolder, nil))
	folderData := resp.JSON()["items"].([]interface{})
	if len(folderData) == 0 {
		return "", fmt.Errorf("folder %s not found", rootFolder)
	}
	folder := folderData[0].(map[string]interface{})
	path += fmt.Sprintf("/%s", folder["hash"].(string))
	matches = matches[1:]
	if len(matches) == 0 {
		return path, nil
	}
	folderNames := matches
	matches = matches[:len(matches)-1]
	subParents := []string{rootFolder}
	tmp := rootFolder
	for _, match := range matches {
		tmp += "/" + match
		subParents = append(subParents, tmp)
	}
	for i, subParent := range subParents {
		name := folderNames[i]
		resp := base.Fetch(buildFolderQuery(name, subParent))
		folderData := resp.JSON()["items"].([]interface{})
		folder = folderData[0].(map[string]interface{})
		if len(folderData) == 0 {
			return "", fmt.Errorf("folder %s not found", name)
		}
		path += fmt.Sprintf("/%s", folder["hash"].(string))
	}
	return path, nil
}
