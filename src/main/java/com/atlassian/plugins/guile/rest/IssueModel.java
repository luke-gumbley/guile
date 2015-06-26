package com.atlassian.plugins.guile.rest;

import org.codehaus.jackson.annotate.JsonIgnoreProperties;

import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;

@JsonIgnoreProperties(ignoreUnknown = true)
@XmlRootElement(name = "result")
@XmlAccessorType(XmlAccessType.FIELD)
public class IssueModel {

	IssueModel() {}

	IssueModel(long id, String key) {
		this.id = id;
		this.key = key;
	}

	@XmlElement(name = "id")
	private long id;
	public long getId() { return id; }
	public void setId(long id) { this.id = id; }

	@XmlElement(name = "key")
	private String key;
	public String getKey() { return key; }
	public void setKey(String key) { this.key = key; }

}
