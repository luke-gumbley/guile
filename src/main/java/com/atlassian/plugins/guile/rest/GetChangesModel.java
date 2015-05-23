package com.atlassian.plugins.guile.rest;

import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;
import java.util.List;
import java.util.Map;

@XmlRootElement(name = "result")
@XmlAccessorType(XmlAccessType.FIELD)
public class GetChangesModel {

    @XmlElement(name = "changes")
    private Map<String, List<ChangeModel>> changes;
    public Map<String, List<ChangeModel>> getChanges() { return changes; }
    public void setChanges(Map<String, List<ChangeModel>> value) { changes = value; }

    public GetChangesModel() {
    }

    public GetChangesModel(Map<String, List<ChangeModel>> changes) {
        this.changes = changes;
    }

}
